import { randomUUID } from 'node:crypto';

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { ItinerariesService } from '../../itineraries/application/itineraries.service';
import { ItinerarySource } from '../../itineraries/domain/entities/itinerary-item.entity';
import { ItineraryUpdateStatus } from '../../itineraries/application/dto/itinerary.dto';
import { SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity, type TripAiPlanRequest } from '../../trips/domain/entities/trip.entity';
import {
  AI_PLANNER_PORT,
  AiPlannerError,
  type AiPlannerDay,
  type AiPlannerLodging,
  type AiPlannerInput,
  type AiPlannerOutput,
  type AiPlannerPort,
  TravelTheme,
} from '../domain/ai-planner.port';
import {
  AiPlanExecutionStatus,
  type AiPlanExecutionStatusResponseDto,
  AiPlanGenerationStatus,
  GenerateAiPlanResponseDto,
  LatestAiPlanRequestResponseDto,
} from './dto/generate-ai-plan.dto';
import { AiPlanningRateLimiter } from './ai-planning-rate-limiter';
import { EntitlementsService } from '../../entitlements/application/entitlements.service';
import { PlacePreference, PlaceTag } from '../../places/domain/entities/saved-place.entity';
import {
  PLACE_SEARCH_PORT,
  type PlaceSearchCandidate,
  type PlaceSearchPort,
} from '../../places/domain/place-search.port';
import { AiBudgetLevel, AiTransportMode, type GenerateAiPlanDto } from './dto/generate-ai-plan.dto';
import { writeStructuredLog } from '../../../common/http/json-logger';

type PlannedPlacement = {
  savedPlaceId: string;
  date: string;
  position: number;
  locked?: boolean;
  scheduledTime?: string;
  durationMinutes?: number;
  activitySummary?: string;
  travelMethod?: string;
  travelDurationMinutes?: number;
};

@Injectable()
export class AiPlanningService {
  private readonly executionStatuses = new Map<string, AiPlanExecutionStatusResponseDto>();
  private readonly logger = new Logger(AiPlanningService.name);
  constructor(
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(SavedPlaceEntity) private readonly places: Repository<SavedPlaceEntity>,
    @Inject(AI_PLANNER_PORT) private readonly planner: AiPlannerPort,
    @Inject(ItinerariesService) private readonly itineraries: ItinerariesService,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(AiPlanningRateLimiter) private readonly rateLimiter: AiPlanningRateLimiter,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
    @Inject(PLACE_SEARCH_PORT) private readonly placeSearch: PlaceSearchPort,
  ) {}

  async getLatestRequest(tripId: string): Promise<LatestAiPlanRequestResponseDto> {
    const trip = await this.trips.findOneBy({
      id: tripId,
      ownerId: this.identity.getCurrentUserId(),
      active: true,
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return { request: normalizeLatestAiPlanRequest(trip.latestAiPlanRequest) };
  }

  async getStatus(tripId: string): Promise<AiPlanExecutionStatusResponseDto> {
    const trip = await this.trips.findOneBy({
      id: tripId,
      ownerId: this.identity.getCurrentUserId(),
      active: true,
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return this.executionStatuses.get(tripId) ?? {
      generationId: null,
      status: AiPlanExecutionStatus.Idle,
      failureReason: null,
    };
  }

  async generateDay(tripId: string, date: string): Promise<GenerateAiPlanResponseDto> {
    const trip = await this.trips.findOneBy({
      id: tripId,
      ownerId: this.identity.getCurrentUserId(),
      active: true,
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < trip.startDate || date > trip.endDate) {
      throw new BadRequestException('AI_PLAN_DATE_OUT_OF_RANGE');
    }
    return this.generate(tripId, normalizeLatestAiPlanRequest(trip.latestAiPlanRequest) ?? defaultAiPlanRequest(), date);
  }

  async generate(tripId: string, request: GenerateAiPlanDto, targetDate?: string): Promise<GenerateAiPlanResponseDto> {
    const generationId = randomUUID();
    const startedAt = performance.now();
    this.rateLimiter.assertAllowed(this.identity.getCurrentUserId());
    await this.entitlements.assertCanGenerateAiPlan();
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!targetDate) {
      trip.latestAiPlanRequest = normalizeLatestAiPlanRequest(request);
      await this.trips.save(trip);
    }
    const loadedPlaces = await this.places.find({ where: { tripId }, order: { createdAt: 'ASC' } });
    const invalidAiPlaceholders = loadedPlaces.filter(isInvalidAiPlaceholderPlace);
    if (invalidAiPlaceholders.length > 0) await this.places.remove(invalidAiPlaceholders);
    const places = loadedPlaces.filter((place) => !invalidAiPlaceholders.includes(place));
    const primaryLodging = places.find((place) => place.isPrimaryLodging);
    const current = await this.itineraries.get(tripId);
    const placesById = new Map(places.map((place) => [place.id, place]));
    const targetDatePlaceIds = new Set(current.items
      .filter((item) => !targetDate || item.date === targetDate)
      .map((item) => item.savedPlaceId));
    const travelerDuplicatePlaceIds = findTravelerDuplicatePlaceIds(current.items, placesById);
    const locked = current.items.filter((item) =>
      (item.locked || travelerDuplicatePlaceIds.has(item.savedPlaceId))
      && !item.boundaryType
      && item.date !== null
      && item.position !== null
      && (!targetDate || item.date === targetDate)
      && placesById.get(item.savedPlaceId)?.tag !== PlaceTag.Lodging,
    );
    const lockedIds = new Set(locked.map((item) => item.savedPlaceId));
    const planningPlaces = places.filter((place) =>
      place.tag !== PlaceTag.Lodging
      && !isAiRecommendedPlace(place)
      && (!targetDate || targetDatePlaceIds.has(place.id)),
    );
    if (planningPlaces.length > 100) throw new BadRequestException('AI planning supports at most 100 saved places');
    const days = buildPlannerDays(enumerateTripDates(trip.startDate, trip.endDate), current.items, places, primaryLodging)
      .filter((day) => !targetDate || day.date === targetDate);
    let createdRecommendationEntities: SavedPlaceEntity[] = [];
    let stage = 'preparing';
    this.executionStatuses.set(tripId, {
      generationId,
      status: AiPlanExecutionStatus.Running,
      failureReason: null,
    });
    try {
      writeStructuredLog('info', 'ai.generation.started', {
        generationId,
        tripId,
        dayCount: days.length,
        savedPlaceCount: planningPlaces.length,
        themes: request.themes,
      });
      const plannerInput: AiPlannerInput = {
        preferences: {
          themes: request.themes,
          companions: request.companions ?? null,
          transportModes: request.transportModes,
          budgetLevel: request.budgetLevel ?? AiBudgetLevel.Standard,
          additionalRequests: request.additionalRequests ?? null,
        },
        trip: {
          title: trip.title, destination: trip.destination,
          regions: (trip.regions ?? []).map(({ name, address, latitude, longitude }) => ({ name, address, latitude, longitude })),
          timezone: trip.timezone, startDate: trip.startDate, endDate: trip.endDate,
          startPoint: trip.startPoint ?? null, endPoint: trip.endPoint ?? null,
          lodgings: places.filter((place) => place.tag === PlaceTag.Lodging || place.isPrimaryLodging).map((place) => ({
            savedPlaceId: place.id, name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude,
          })),
        },
        places: planningPlaces.map((place) => ({
          id: place.id, name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude,
          tag: place.tag, preference: place.preference, note: place.note,
        })),
        days,
      };
      stage = 'initial_generation';
      const output = normalizeVisitOrder(await this.planner.generate(plannerInput, { generationId, tripId }));
      writeStructuredLog('info', 'ai.generation.output_received', {
        generationId, tripId,
        receivedDayCount: output.days.length,
        receivedVisitCount: output.days.reduce((count, day) => count + day.visits.length, 0),
        visitsByDate: output.days.map((day) => ({ date: day.date, visitCount: day.visits.length })),
      });
      const validDates = new Set(days.map((day) => day.date));
      stage = 'materialization';
      const materialized = await this.materializeVisits(
        trip.id, trip.destination, output.days, places,
        new Set(planningPlaces.map((place) => place.id)), validDates, lockedIds,
      );
      createdRecommendationEntities = materialized.created;
      writeStructuredLog('info', 'ai.generation.visits_materialized', {
        generationId, tripId,
        mappedVisitCount: materialized.placements.length,
        createdPlaceCount: materialized.created.length,
        unresolved: materialized.unresolved,
      });
      stage = 'saving';
      const placementsWithLodging = addLodgingEndpoints(
        mergeLockedPlacements(locked, materialized.placements),
        days,
      );
      const persistedPlacements = placementsWithLodging.map((placement) => ({
        savedPlaceId: placement.savedPlaceId,
        date: placement.date,
        position: placement.position,
        ...(placement.locked !== undefined ? { locked: placement.locked } : {}),
        ...(placement.scheduledTime !== undefined ? { scheduledTime: placement.scheduledTime } : {}),
        ...(placement.durationMinutes !== undefined ? { durationMinutes: placement.durationMinutes } : {}),
        ...(placement.activitySummary !== undefined ? { activitySummary: placement.activitySummary } : {}),
        ...(placement.travelMethod !== undefined ? { travelMethod: placement.travelMethod } : {}),
        ...(placement.travelDurationMinutes !== undefined ? { travelDurationMinutes: placement.travelDurationMinutes } : {}),
      }));
      const result = targetDate
        ? await this.itineraries.replaceDay(tripId, targetDate, persistedPlacements, ItinerarySource.Ai, [])
        : await this.itineraries.replace(tripId, persistedPlacements, ItinerarySource.Ai, []);
      const finalItinerary = result.itinerary;
      if (result.status === ItineraryUpdateStatus.Updated) {
        await this.applyMissingPlaceDescriptions(places, output.days);
        await this.entitlements.recordSuccessfulAiGeneration();
        createdRecommendationEntities = [];
      } else if (createdRecommendationEntities.length > 0) {
        await this.places.remove(createdRecommendationEntities);
        createdRecommendationEntities = [];
      }
      const lodgingIds = new Set(places.filter(isLodging).map((place) => place.id));
      const savedScopeItems = finalItinerary.items.filter((item) =>
        item.date !== null && validDates.has(item.date) && !item.boundaryType,
      );
      const savedVisits = savedScopeItems.filter((item) => !lodgingIds.has(item.savedPlaceId));
      writeStructuredLog('info', 'ai.generation.completed', {
        generationId,
        tripId,
        status: result.status,
        durationMs: Math.round(performance.now() - startedAt),
        receivedDayCount: output.days.length,
        receivedVisitCount: output.days.reduce((count, day) => count + day.visits.length, 0),
        savedVisitCount: savedVisits.length,
        lodgingConnectionCount: savedScopeItems.length - savedVisits.length,
        savedVisitsByDate: days.map((day) => ({
          date: day.date, visitCount: savedVisits.filter((item) => item.date === day.date).length,
        })),
      });
      this.executionStatuses.set(tripId, {
        generationId,
        status: result.status === ItineraryUpdateStatus.Updated
          ? AiPlanExecutionStatus.Generated
          : AiPlanExecutionStatus.Conflict,
        failureReason: null,
      });
      return {
        status: result.status === ItineraryUpdateStatus.Updated ? AiPlanGenerationStatus.Generated : AiPlanGenerationStatus.Conflict,
        themes: request.themes,
        conflicts: result.conflicts,
        itinerary: finalItinerary,
        failureReason: null,
      };
    } catch (error) {
      const reason = error instanceof AiPlannerError ? error.reason : 'provider_failure';
      // Write before cleanup so a cleanup failure cannot hide the original reason.
      writeStructuredLog('error', 'ai.generation.failed', {
        generationId, tripId, stage, reason,
        durationMs: Math.round(performance.now() - startedAt),
        ...(error instanceof AiPlannerError ? { details: error.details } : {
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : undefined,
        }),
      });
      if (createdRecommendationEntities.length > 0) {
        try {
          await this.places.remove(createdRecommendationEntities);
        } catch {
          this.logger.error('AI recommendation cleanup failed');
        }
      }
      this.executionStatuses.set(tripId, {
        generationId,
        status: AiPlanExecutionStatus.Unavailable,
        failureReason: reason,
      });
      return {
        status: AiPlanGenerationStatus.Unavailable,
        themes: request.themes,
        conflicts: [],
        itinerary: await this.itineraries.get(tripId),
        failureReason: reason,
      };
    }
  }

  private async applyMissingPlaceDescriptions(
    existingPlaces: SavedPlaceEntity[],
    days: AiPlannerOutput['days'],
  ): Promise<void> {
    const descriptions = new Map(days.flatMap((day) => day.visits)
      .filter((visit) => visit.savedPlaceId !== null)
      .map((visit) => [visit.savedPlaceId!, visit.description.trim()]));
    const updates = existingPlaces.filter((place) => {
      if (place.note?.trim()) return false;
      const description = descriptions.get(place.id);
      if (!description) return false;
      place.note = description;
      return true;
    });
    if (updates.length === 0) return;
    try {
      await this.places.save(updates);
    } catch {
      this.logger.error('AI place description update failed');
    }
  }

  private async materializeVisits(
    tripId: string, destination: string, days: AiPlannerOutput['days'],
    existingPlaces: SavedPlaceEntity[], allowedPlaceIds: Set<string>,
    validDates: Set<string>, lockedIds: Set<string>,
  ): Promise<{ placements: PlannedPlacement[]; created: SavedPlaceEntity[]; unresolved: Array<{ placeName: string; reason: string }> }> {
    // Check only reference/date integrity before any place is written. Empty or sparse plans are not vetoed.
    const seenDates = new Set<string>();
    for (const day of days) {
      if (!validDates.has(day.date) || seenDates.has(day.date)) {
        throw new AiPlannerError('invalid_output', { issue: 'invalid_day_reference', date: day.date });
      }
      seenDates.add(day.date);
      for (const visit of day.visits) {
        if (visit.savedPlaceId !== null && !allowedPlaceIds.has(visit.savedPlaceId)) {
          throw new AiPlannerError('invalid_output', { issue: 'unknown_saved_place_id', savedPlaceId: visit.savedPlaceId });
        }
      }
    }
    const placements: PlannedPlacement[] = [];
    const created: SavedPlaceEntity[] = [];
    const unresolved: Array<{ placeName: string; reason: string }> = [];
    try {
      for (const day of days) {
        let materializedPosition = 0;
        for (const visit of day.visits) {
          if (visit.savedPlaceId && lockedIds.has(visit.savedPlaceId)) continue;
          let entity = existingPlaces.find((place) => place.id === visit.savedPlaceId);
          if (!entity) {
            let candidate: PlaceSearchCandidate | undefined;
            let unresolvedReason: 'not_found' | 'lookup_failed' = 'not_found';
            try {
              candidate = (await this.placeSearch.search(visit.placeName, `${visit.regionName}, ${destination}`))[0];
            } catch {
              unresolvedReason = 'lookup_failed';
            }
            if (!candidate && isGenericActivityName(visit.placeName)) {
              unresolved.push({ placeName: visit.placeName, reason: 'generic_activity' });
              continue;
            }
            if (!candidate) unresolved.push({ placeName: visit.placeName, reason: unresolvedReason });
            // Lookup supplies metadata only. Missing search results do not delete AI visits.
            entity = [...existingPlaces, ...created].find((place) => candidate?.googlePlaceId
              ? place.googlePlaceId === candidate.googlePlaceId
              : place.name.trim().toLocaleLowerCase() === visit.placeName.trim().toLocaleLowerCase());
            if (!entity) {
              const newPlace = this.places.create({
                tripId, googlePlaceId: candidate?.googlePlaceId ?? null,
                name: candidate?.name ?? visit.placeName, address: candidate?.address ?? null,
                latitude: candidate?.latitude ?? null, longitude: candidate?.longitude ?? null,
                tag: candidate ? recommendationTag(candidate) : PlaceTag.Other,
                preference: PlacePreference.IfTimeAllows,
                note: `AI 추천 · ${visit.description}`,
                isPrimaryLodging: false,
              });
              try {
                entity = await this.places.save(newPlace);
                created.push(entity);
              } catch (error) {
                if (!candidate?.googlePlaceId || !isUniqueViolation(error)) throw error;
                entity = await this.places.findOneBy({ tripId, googlePlaceId: candidate.googlePlaceId }) ?? undefined;
                if (!entity) throw error;
              }
            }
          }
          placements.push({
            savedPlaceId: entity.id, date: day.date, position: materializedPosition++,
            scheduledTime: visit.startTime, durationMinutes: visit.durationMinutes,
            activitySummary: visit.description,
          });
        }
      }
      return { placements, created, unresolved };
    } catch (error) {
      // The caller has no access to a partial return value if materialization fails.
      if (created.length > 0) {
        try { await this.places.remove(created); } catch { this.logger.error('AI recommendation cleanup failed'); }
      }
      throw error;
    }
  }
}

export function normalizeVisitOrder(output: AiPlannerOutput): AiPlannerOutput {
  return {
    ...output,
    days: output.days.map((day) => ({
      ...day,
      visits: [...day.visits].sort((left, right) => left.startTime.localeCompare(right.startTime)),
    })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'driverError' in error
    && typeof error.driverError === 'object'
    && error.driverError !== null
    && 'code' in error.driverError
    && error.driverError.code === '23505';
}


export function findTravelerDuplicatePlaceIds(
  items: Array<{ savedPlaceId: string }>,
  placesById: Map<string, Pick<SavedPlaceEntity, 'note'>>,
): Set<string> {
  const placementCounts = items.reduce((counts, item) => {
    counts.set(item.savedPlaceId, (counts.get(item.savedPlaceId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  return new Set(
    [...placementCounts]
      .filter(([placeId, count]) => count > 1 && !isAiRecommendedPlace(placesById.get(placeId) ?? { note: null }))
      .map(([placeId]) => placeId),
  );
}

function recommendationTag(candidate: PlaceSearchCandidate): PlaceTag {
  const type = candidate.primaryType ?? '';
  if (type.includes('restaurant') || type.includes('food')) return PlaceTag.Food;
  if (type.includes('cafe') || type.includes('coffee')) return PlaceTag.Cafe;
  if (type.includes('store') || type.includes('shopping') || type === 'market') return PlaceTag.Shopping;
  if (type.includes('station') || type === 'airport') return PlaceTag.Transport;
  if (
    type.includes('tourist')
    || type.includes('museum')
    || type.includes('park')
    || type.includes('temple')
    || type.includes('shrine')
    || type.includes('landmark')
    || type.includes('gallery')
    || type.includes('cultural')
  ) return PlaceTag.Attraction;
  return PlaceTag.Other;
}

export function addLodgingEndpoints(
  placements: PlannedPlacement[],
  days: AiPlannerDay[],
): PlannedPlacement[] {
  return days.flatMap((day) => {
    const dayPlacements = placements
      .filter((item) => item.date === day.date)
      .sort((left, right) => left.position - right.position);
    const start = day.startLodging
      ? [{ savedPlaceId: day.startLodging.savedPlaceId, date: day.date, position: 0, locked: false }]
      : [];
    const offset = start.length;
    const visits = dayPlacements.map((item, index) => ({ ...item, position: index + offset }));
    const end = day.endLodging
      ? [{ savedPlaceId: day.endLodging.savedPlaceId, date: day.date, position: visits.length + offset, locked: false }]
      : [];
    return [...start, ...visits, ...end];
  });
}

export function buildPlannerDays(
  dates: string[],
  itineraryItems: Array<{ savedPlaceId: string; date: string | null; position: number | null }>,
  places: Array<Pick<SavedPlaceEntity, 'id' | 'name' | 'address' | 'latitude' | 'longitude' | 'tag' | 'isPrimaryLodging'>>,
  primaryLodging?: Pick<SavedPlaceEntity, 'id' | 'name' | 'address' | 'latitude' | 'longitude' | 'tag' | 'isPrimaryLodging'>,
): AiPlannerDay[] {
  const placesById = new Map(places.map((place) => [place.id, place]));
  return dates.map((date, index) => {
    const items = itineraryItems
      .filter((item) => item.date === date && item.position !== null)
      .sort((left, right) => left.position! - right.position!);
    const first = placesById.get(items[0]?.savedPlaceId ?? '');
    const last = placesById.get(items.at(-1)?.savedPlaceId ?? '');
    return {
      date,
      isFirstDay: index === 0,
      isLastDay: index === dates.length - 1,
      startLodging: index === 0 ? null : toLodging(isLodging(first) ? first : primaryLodging),
      endLodging: index === dates.length - 1 ? null : toLodging(isLodging(last) ? last : primaryLodging),
    };
  });
}

export function enumerateTripDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function isAiRecommendedPlace(place: Pick<SavedPlaceEntity, 'note'>): boolean {
  return place.note?.startsWith('AI 추천 ·') ?? false;
}

export function isGenericActivityName(name: string): boolean {
  const normalized = name.trim().replace(/\s+/g, ' ');
  return /(?:픽업|수령|구매|구입|식사|아침|점심|저녁|산책|휴식|자유\s*시간|체크인|체크아웃|짐\s*(?:보관|수령)|이동|환승|탑승|하차|둘러보기|구경)(?:\s*[·.!?…]*)$/u.test(normalized);
}

function isInvalidAiPlaceholderPlace(place: Pick<SavedPlaceEntity, 'note' | 'name' | 'latitude' | 'longitude'>): boolean {
  return isAiRecommendedPlace(place)
    && place.latitude === null
    && place.longitude === null
    && isGenericActivityName(place.name);
}

function normalizeLatestAiPlanRequest(input: TripAiPlanRequest | null): GenerateAiPlanDto | null {
  if (!input) return null;
  const themeValues = new Set(Object.values(TravelTheme));
  const transportValues = new Set(Object.values(AiTransportMode));
  const budgetValues = new Set(Object.values(AiBudgetLevel));
  const themes = (input.themes ?? []).filter((theme): theme is TravelTheme => themeValues.has(theme as TravelTheme));
  if (themes.length === 0) themes.push(input.style === 'food' ? TravelTheme.Food : TravelTheme.Highlights);
  const transportModes = (input.transportModes ?? [])
    .filter((mode): mode is AiTransportMode => transportValues.has(mode as AiTransportMode));
  if (transportModes.length === 0) {
    if (input.transportMode === 'mixed') transportModes.push(AiTransportMode.PublicTransit, AiTransportMode.Walking);
    else if (transportValues.has(input.transportMode as AiTransportMode)) transportModes.push(input.transportMode as AiTransportMode);
    else transportModes.push(AiTransportMode.PublicTransit);
  }
  const legacyRequests = [
    input.preferences ? `좋아하는 것: ${input.preferences}` : '',
    input.avoidances ? `피하고 싶은 것: ${input.avoidances}` : '',
  ].filter(Boolean).join('\n');
  return {
    themes,
    transportModes,
    ...(input.companions ? { companions: input.companions } : {}),
    ...(budgetValues.has(input.budgetLevel as AiBudgetLevel) ? { budgetLevel: input.budgetLevel as AiBudgetLevel } : {}),
    ...((input.additionalRequests || legacyRequests) ? { additionalRequests: input.additionalRequests || legacyRequests } : {}),
  };
}

function defaultAiPlanRequest(): GenerateAiPlanDto {
  return {
    themes: [TravelTheme.Highlights],
    transportModes: [AiTransportMode.PublicTransit],
    budgetLevel: AiBudgetLevel.Standard,
  };
}

function isLodging(
  place: Pick<SavedPlaceEntity, 'tag' | 'isPrimaryLodging'> | undefined,
): boolean {
  return Boolean(place && (place.tag === PlaceTag.Lodging || place.isPrimaryLodging));
}

function toLodging(
  place: Pick<SavedPlaceEntity, 'id' | 'name' | 'address' | 'latitude' | 'longitude'> | undefined,
): AiPlannerLodging | null {
  if (!place) return null;
  return {
    savedPlaceId: place.id,
    name: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

function mergeLockedPlacements(
  locked: Array<{ savedPlaceId: string; date: string | null; position: number | null; scheduledTime?: string | null; durationMinutes?: number | null; activitySummary?: string | null; travelMethod?: string | null; travelDurationMinutes?: number | null }>,
  generated: PlannedPlacement[],
): PlannedPlacement[] {
  const dates = new Set([...locked.map((item) => item.date!), ...generated.map((item) => item.date)]);
  return [...dates].flatMap((date) => {
    const fixed = locked.filter((item) => item.date === date).sort((a, b) => a.position! - b.position!);
    const movable = generated.filter((item) => item.date === date).sort((a, b) => a.position - b.position);
    let movableIndex = 0;
    const result: PlannedPlacement[] = [];
    const size = fixed.length + movable.length;
    const maxPosition = Math.max(size - 1, ...fixed.map((item) => item.position!));
    for (let position = 0; position <= maxPosition; position += 1) {
      const fixedItem = fixed.find((item) => item.position === position);
      if (fixedItem) result.push({ savedPlaceId: fixedItem.savedPlaceId, date, position, locked: true,
        scheduledTime: fixedItem.scheduledTime ?? undefined, durationMinutes: fixedItem.durationMinutes ?? undefined,
        activitySummary: fixedItem.activitySummary ?? undefined, travelMethod: fixedItem.travelMethod ?? undefined,
        travelDurationMinutes: fixedItem.travelDurationMinutes ?? undefined });
      else {
        const item = movable[movableIndex++];
        if (item) result.push({ ...item, position, locked: false });
      }
    }
    // Preserved traveler visits keep their date, time and content, but their old
    // position must not make the newly generated timetable run backwards.
    // Unknown times remain after timed visits in their existing relative order.
    return result
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const leftTime = left.item.scheduledTime;
        const rightTime = right.item.scheduledTime;
        if (leftTime && rightTime) return leftTime.localeCompare(rightTime) || left.index - right.index;
        if (leftTime) return -1;
        if (rightTime) return 1;
        return left.index - right.index;
      })
      .map(({ item }, position) => ({ ...item, position }));
  });
}
