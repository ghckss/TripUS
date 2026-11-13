import { randomUUID } from 'node:crypto';

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { ItinerariesService } from '../../itineraries/application/itineraries.service';
import { ItinerarySource } from '../../itineraries/domain/entities/itinerary-item.entity';
import { ItineraryUpdateStatus } from '../../itineraries/application/dto/itinerary.dto';
import { SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import {
  AI_PLANNER_PORT,
  AiPlannerError,
  type AiPlannerDay,
  type AiPlannerLodging,
  type AiPlannerInput,
  type AiPlannerOutput,
  type AiPlannerPort,
  AI_PLANNING_TASK,
  TRAVEL_STYLE_POLICIES,
  TravelStyle,
} from '../domain/ai-planner.port';
import { AiPlanGenerationStatus, GenerateAiPlanResponseDto } from './dto/generate-ai-plan.dto';
import { AiPlanningRateLimiter } from './ai-planning-rate-limiter';
import { EntitlementsService } from '../../entitlements/application/entitlements.service';
import { PlacePreference, PlaceTag } from '../../places/domain/entities/saved-place.entity';
import { PLACE_SEARCH_PORT, type PlaceSearchCandidate, type PlaceSearchPort } from '../../places/domain/place-search.port';
import { ROUTES_PORT, type RoutesPort } from '../../routes/domain/routes.port';
import { AiTransportMode, type GenerateAiPlanDto } from './dto/generate-ai-plan.dto';
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

const MAX_PLANNER_ATTEMPTS = 3;
const MAX_MATERIALIZATION_ATTEMPTS = 2;
const DEFAULT_DAY_START_MINUTES = 9 * 60;
const DEFAULT_DAY_END_MINUTES = 21 * 60;
const BOUNDARY_TRANSITION_BUFFER_MINUTES = 60;

@Injectable()
export class AiPlanningService {
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
    @Inject(ROUTES_PORT) private readonly routes: RoutesPort,
  ) {}

  async generate(tripId: string, request: GenerateAiPlanDto): Promise<GenerateAiPlanResponseDto> {
    const { style } = request;
    const generationId = randomUUID();
    const startedAt = performance.now();
    this.rateLimiter.assertAllowed(this.identity.getCurrentUserId());
    await this.entitlements.assertCanGenerateAiPlan();
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    const places = await this.places.find({ where: { tripId }, order: { createdAt: 'ASC' } });
    const primaryLodging = places.find((place) => place.isPrimaryLodging);
    const current = await this.itineraries.get(tripId);
    const placesById = new Map(places.map((place) => [place.id, place]));
    const locked = current.items.filter((item) =>
      item.locked
      && !item.boundaryType
      && item.date !== null
      && item.position !== null
      && placesById.get(item.savedPlaceId)?.tag !== PlaceTag.Lodging,
    );
    const lockedIds = new Set(locked.map((item) => item.savedPlaceId));
    const previousAiRecommendations = places.filter(isAiRecommendedPlace);
    const selectedRegions = trip.regions ?? [];
    const planningPlaces = places.filter((place) =>
      place.tag !== PlaceTag.Lodging
      && !lockedIds.has(place.id)
      && !isAiRecommendedPlace(place),
    );
    const recommendationRegions = [
      ...selectedRegions,
      ...planningPlaces.map((place) => ({
        name: place.address ?? place.name,
        latitude: place.latitude,
        longitude: place.longitude,
      })),
    ];
    if (planningPlaces.length > 100) throw new BadRequestException('AI planning supports at most 100 saved places');
    const days = applyDailyPlanningTargets(
      buildPlannerDays(enumerateTripDates(trip.startDate, trip.endDate), current.items, places, primaryLodging),
      style,
      trip.startPoint?.time ?? null,
      trip.endPoint?.time ?? null,
    );
    let createdRecommendationEntities: SavedPlaceEntity[] = [];
    try {
      writeStructuredLog('info', 'ai.generation.started', {
        generationId,
        tripId,
        dayCount: days.length,
        savedPlaceCount: planningPlaces.length,
        style,
      });
      const plannerInput: AiPlannerInput = {
        task: AI_PLANNING_TASK,
        trip: {
          title: trip.title,
          destination: trip.destination,
          regions: (trip.regions ?? []).map(({ name, address, latitude, longitude }) => ({ name, address, latitude, longitude })),
          timezone: trip.timezone,
          startDate: trip.startDate,
          endDate: trip.endDate,
          startPoint: trip.startPoint ?? null,
          endPoint: trip.endPoint ?? null,
        },
        style: TRAVEL_STYLE_POLICIES[style],
        travelerContext: {
          companions: request.companions?.trim() || null,
          transportMode: request.transportMode ?? null,
          budgetLevel: request.budgetLevel ?? null,
          preferences: request.preferences?.trim() || null,
          avoidances: request.avoidances?.trim() || null,
        },
        places: planningPlaces.map((place) => ({
          id: place.id,
          name: place.name,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          tag: place.tag,
          preference: place.preference,
          note: place.note,
        })),
        days,
        lockedPlacements: locked.map((item) => ({ savedPlaceId: item.savedPlaceId, date: item.date!, position: item.position! })),
        priorRecommendations: previousAiRecommendations.map((place) => place.name),
      };
      let output = await this.planner.generate(plannerInput);
      const allowedPlannerPlaceIds = new Set(planningPlaces.map((place) => place.id));
      for (let attempt = 1; attempt < MAX_PLANNER_ATTEMPTS; attempt += 1) {
        const outputContractIssues = assessRawOutputContract(allowedPlannerPlaceIds, output);
        const coverageIssues = assessRawDayCoverage(days, output, style, allowedPlannerPlaceIds);
        if (outputContractIssues.length === 0 && coverageIssues.length === 0) break;
        writeStructuredLog('warn', 'ai.generation.draft_revision', {
          generationId,
          tripId,
          attempt,
          maxAttempts: MAX_PLANNER_ATTEMPTS,
          contractIssues: outputContractIssues,
          underfilledDates: coverageIssues,
        });
        const revisionGuidance = [
          ...(outputContractIssues.includes('unknown_placement_ids')
            ? ['Every placements.savedPlaceId must exactly match an ID from places. Never create or guess an ID.']
            : []),
          ...(outputContractIssues.includes('recommendations_required')
            ? ['The places array is empty. Return placements as [] and put every concrete itinerary visit in recommendations.']
            : []),
          ...(outputContractIssues.includes('saved_places_missing')
            ? ['One or more traveler-saved places were omitted. Place every ID from places exactly once in placements.']
            : []),
          ...(outputContractIssues.includes('saved_places_unplaced')
            ? [
              `Do not return traveler-saved places in unplaced. Rebuild the route so these explicit user choices are scheduled: ${formatUnplacedSavedPlaces(output, planningPlaces)}.`,
              'A saved place outside trip.regions is an explicit traveler-approved exception and must still be scheduled.',
            ]
            : []),
          ...(coverageIssues.length > 0
            ? [
              `The previous draft is still too short on: ${coverageIssues.join(', ')}.`,
              `Required totals by date are: ${formatCoverageTargets(days, coverageIssues, style)}.`,
              'Update the entire itinerary by adding nearby recommendations, meals, cafes, and activities so each listed date reaches that total without rushing.',
              'Keep previous recommendations that are still optimal, but add or replace places as needed. Return the complete revised itinerary, not only the added visits.',
            ]
            : []),
        ];
        output = await this.planner.generate({
          ...plannerInput,
          revisionGuidance: revisionGuidance.join(' '),
        });
      }
      this.logger.log(
        `AI itinerary generated placements=${output.placements.length} recommendations=${output.recommendations.length}`
        + (output.usage ? ` inputTokens=${output.usage.inputTokens} outputTokens=${output.usage.outputTokens}` : ''),
      );
      const validDates = new Set(days.map((day) => day.date));
      let materialized: Awaited<ReturnType<AiPlanningService['materializeRecommendations']>>;
      let generated: PlannedPlacement[];
      let qualityIssues: string[];
      for (let materializationAttempt = 1; ; materializationAttempt += 1) {
        materialized = await this.materializeRecommendations(
          trip.id,
          trip.destination,
          recommendationRegions,
          output.recommendations,
          places,
          validDates,
        );
        createdRecommendationEntities = materialized.created;
        const allowed = new Set([...planningPlaces.map((place) => place.id), ...materialized.placements.map((item) => item.savedPlaceId)]);
        generated = normalizeGeneratedPlacements(output.placements, allowed, validDates);
        qualityIssues = assessPlanQuality({
          days,
          style,
          planningPlaces,
          generated,
          recommended: materialized.placements,
          locked,
          output,
        });
        const repairableIssues = qualityIssues.filter(isRepairableQualityIssue);
        if (repairableIssues.length === 0 || materializationAttempt >= MAX_MATERIALIZATION_ATTEMPTS) break;

        writeStructuredLog('warn', 'ai.generation.materialization_revision', {
          generationId,
          tripId,
          attempt: materializationAttempt,
          issues: repairableIssues,
          rejectedRecommendations: materialized.rejected,
        });
        if (createdRecommendationEntities.length > 0) await this.places.remove(createdRecommendationEntities);
        createdRecommendationEntities = [];
        output = await this.planner.generate({
          ...plannerInput,
          revisionGuidance: [
            `The verified itinerary still has these issues: ${repairableIssues.join(', ')}.`,
            ...(repairableIssues.includes('saved_places_unplaced')
              ? [
                `Schedule these traveler-saved places instead of returning them in unplaced: ${formatUnplacedSavedPlaces(output, planningPlaces)}.`,
                'Traveler-saved places outside the selected regions are intentional route anchors, not invalid locations.',
              ]
              : []),
            materialized.rejected.length > 0
              ? `These recommendations could not be verified and must be replaced with different concrete places: ${materialized.rejected.map((item) => item.placeName).join(', ')}.`
              : '',
            `Required totals by date are: ${formatCoverageTargets(days, days.map((day) => day.date), style)}.`,
            'Return the complete corrected itinerary. Keep valid saved-place placements, replace unverifiable recommendations, and use chronological non-overlapping times.',
          ].filter(Boolean).join(' '),
        });
      }
      const recommended = materialized.placements;
      const reusedRecommendationIds = new Set(recommended.map((item) => item.savedPlaceId));
      const staleAiRecommendations = previousAiRecommendations.filter((place) =>
        !lockedIds.has(place.id) && !reusedRecommendationIds.has(place.id),
      );
      writeStructuredLog('info', 'ai.generation.recommendations_materialized', {
        generationId,
        tripId,
        received: output.recommendations.length,
        saved: recommended.length,
        rejected: materialized.rejected,
      });
      const blockingQualityIssues = qualityIssues.filter(isBlockingQualityIssue);
      const qualityWarnings = qualityIssues.filter((issue) => !isBlockingQualityIssue(issue));
      if (qualityWarnings.length > 0) {
        writeStructuredLog('warn', 'ai.generation.accepted_with_warnings', {
          generationId,
          tripId,
          warnings: qualityWarnings,
        });
      }
      if (blockingQualityIssues.length > 0) {
        if (createdRecommendationEntities.length > 0) await this.places.remove(createdRecommendationEntities);
        createdRecommendationEntities = [];
        writeStructuredLog('warn', 'ai.generation.rejected', {
          generationId,
          tripId,
          issues: blockingQualityIssues,
        });
        throw new AiPlannerError('invalid_output');
      }
      const placementsWithLodging = addLodgingEndpoints(
        mergeLockedPlacements(locked, [...generated, ...recommended]),
        days,
      );
      const placements = await this.enrichTravelEstimates(
        placementsWithLodging,
        [...places, ...materialized.created],
        request.transportMode,
      );
      const result = await this.itineraries.replace(tripId, placements, ItinerarySource.Ai);
      let finalItinerary = result.itinerary;
      if (result.status === ItineraryUpdateStatus.Updated) {
        await this.entitlements.recordSuccessfulAiGeneration();
        createdRecommendationEntities = [];
        if (staleAiRecommendations.length > 0) {
          try {
            await this.places.remove(staleAiRecommendations);
            finalItinerary = await this.itineraries.get(tripId);
          } catch {
            this.logger.error('Previous AI recommendation cleanup failed');
          }
        }
      } else if (createdRecommendationEntities.length > 0) {
        await this.places.remove(createdRecommendationEntities);
        createdRecommendationEntities = [];
      }
      writeStructuredLog('info', 'ai.generation.completed', {
        generationId,
        tripId,
        status: result.status,
        durationMs: Math.round(performance.now() - startedAt),
        placementCount: placements.length,
      });
      return {
        status: result.status === ItineraryUpdateStatus.Updated ? AiPlanGenerationStatus.Generated : AiPlanGenerationStatus.Conflict,
        style,
        conflicts: result.conflicts,
        itinerary: finalItinerary,
        failureReason: null,
      };
    } catch (error) {
      if (createdRecommendationEntities.length > 0) {
        try {
          await this.places.remove(createdRecommendationEntities);
        } catch {
          this.logger.error('AI recommendation cleanup failed');
        }
      }
      const reason = error instanceof AiPlannerError ? error.reason : 'provider_failure';
      writeStructuredLog('error', 'ai.generation.failed', {
        generationId,
        tripId,
        reason,
        durationMs: Math.round(performance.now() - startedAt),
        ...(error instanceof AiPlannerError ? { details: error.details } : {
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : undefined,
        }),
      });
      return {
        status: AiPlanGenerationStatus.Unavailable,
        style,
        conflicts: [],
        itinerary: await this.itineraries.get(tripId),
        failureReason: reason,
      };
    }
  }

  private async materializeRecommendations(
    tripId: string,
    destination: string,
    selectedRegions: Array<{ name: string; latitude?: number | null; longitude?: number | null }>,
    recommendations: AiPlannerOutput['recommendations'],
    existingPlaces: SavedPlaceEntity[],
    validDates: Set<string>,
  ): Promise<{
    placements: PlannedPlacement[];
    created: SavedPlaceEntity[];
    rejected: Array<{ placeName: string; suggestedDate: string; reason: string }>;
  }> {
    const knownGoogleIds = new Set(existingPlaces.flatMap((place) => place.googlePlaceId ? [place.googlePlaceId] : []));
    const knownNames = new Set(existingPlaces.map((place) => place.name.trim().toLocaleLowerCase()));
    const placements: PlannedPlacement[] = [];
    const created: SavedPlaceEntity[] = [];
    const placedIds = new Set<string>();
    const rejected: Array<{ placeName: string; suggestedDate: string; reason: string }> = [];

    for (const recommendation of recommendations) {
      if (!validDates.has(recommendation.suggestedDate)) continue;
      try {
        const candidates = await this.placeSearch.search(
          recommendation.placeName,
          `${recommendation.regionName}, ${destination}`,
        );
        const candidate = candidates.find((item) =>
          isWithinSelectedRegions(recommendation.regionName, item, selectedRegions)
          && isRecommendableCandidate(item),
        );
        if (!candidate) {
          this.logger.warn(`AI recommendation rejected reason=not_found_or_outside_region name=${recommendation.placeName}`);
          rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: 'not_found_or_outside_region' });
          continue;
        }
        const normalizedCandidateName = candidate.name.trim().toLocaleLowerCase();
        const priorAiPlace = findReusableAiRecommendation(existingPlaces, candidate);
        if (priorAiPlace) {
          if (!placedIds.has(priorAiPlace.id)) {
            placedIds.add(priorAiPlace.id);
            placements.push(toRecommendedPlacement(priorAiPlace.id, recommendation));
          }
          continue;
        }
        if (knownGoogleIds.has(candidate.googlePlaceId) || knownNames.has(normalizedCandidateName)) {
          this.logger.warn(`AI recommendation rejected reason=duplicate_saved_place name=${recommendation.placeName}`);
          rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: 'duplicate_saved_place' });
          continue;
        }
        const entity = await this.places.save(this.places.create({
          tripId,
          googlePlaceId: candidate.googlePlaceId,
          name: candidate.name,
          address: candidate.address,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          tag: recommendationTag(candidate),
          preference: PlacePreference.IfTimeAllows,
          note: `AI 추천 · ${recommendation.reason}`,
          isPrimaryLodging: false,
        }));
        knownGoogleIds.add(candidate.googlePlaceId);
        knownNames.add(normalizedCandidateName);
        created.push(entity);
        placedIds.add(entity.id);
        placements.push(toRecommendedPlacement(entity.id, recommendation));
      } catch {
        this.logger.warn(`AI recommended place could not be verified name=${recommendation.placeName}`);
        rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: 'verification_failed' });
      }
    }
    return { placements, created, rejected };
  }

  private async enrichTravelEstimates(
    placements: PlannedPlacement[],
    places: SavedPlaceEntity[],
    transportMode?: AiTransportMode,
  ): Promise<PlannedPlacement[]> {
    if (transportMode && ![AiTransportMode.PublicTransit, AiTransportMode.Mixed].includes(transportMode)) return placements;
    const byId = new Map(places.map((place) => [place.id, place]));
    const enriched = placements.map((placement) => ({ ...placement }));
    for (const date of new Set(enriched.map((placement) => placement.date))) {
      const day = enriched.filter((placement) => placement.date === date).sort((a, b) => a.position - b.position);
      for (let index = 1; index < day.length; index += 1) {
        const origin = byId.get(day[index - 1]!.savedPlaceId);
        const destination = byId.get(day[index]!.savedPlaceId);
        if (!origin?.googlePlaceId || !destination?.googlePlaceId) continue;
        try {
          const route = await this.routes.transit({ originGooglePlaceId: origin.googlePlaceId, destinationGooglePlaceId: destination.googlePlaceId });
          if (route) {
            day[index]!.travelMethod = '대중교통';
            day[index]!.travelDurationMinutes = route.durationMinutes;
          }
        } catch {
          this.logger.warn(`AI route estimate unavailable origin=${origin.id} destination=${destination.id}`);
        }
      }
    }
    return enriched;
  }
}

export function isWithinSelectedRegions(
  recommendationRegionName: string,
  candidate: Pick<PlaceSearchCandidate, 'name' | 'address'> & Partial<Pick<PlaceSearchCandidate, 'latitude' | 'longitude'>>,
  selectedRegions: Array<{ name: string; latitude?: number | null; longitude?: number | null }>,
): boolean {
  if (selectedRegions.length === 0) return true;
  const candidateLocation = normalizeRegionName(`${candidate.name} ${candidate.address ?? ''}`);
  const recommendedRegion = normalizeRegionName(recommendationRegionName);
  return selectedRegions.some((region) => {
    const selectedName = normalizeRegionName(region.name);
    if (candidateLocation.includes(selectedName)) return true;
    if (recommendedRegion.includes(selectedName) && candidateLocation.includes(recommendedRegion)) return true;
    if (
      candidate.latitude == null
      || candidate.longitude == null
      || region.latitude == null
      || region.longitude == null
    ) return false;
    return distanceKilometers(
      candidate.latitude,
      candidate.longitude,
      region.latitude,
      region.longitude,
    ) <= 80;
  });
}

function distanceKilometers(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRecommendedPlacement(
  savedPlaceId: string,
  recommendation: AiPlannerOutput['recommendations'][number],
): PlannedPlacement {
  return {
    savedPlaceId,
    date: recommendation.suggestedDate,
    position: recommendation.position,
    scheduledTime: recommendation.startTime,
    durationMinutes: recommendation.durationMinutes,
    activitySummary: recommendation.activity,
    travelMethod: recommendation.travelMethod,
    travelDurationMinutes: recommendation.travelDurationMinutes,
  };
}

function normalizeRegionName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replaceAll(/\s+/g, '')
    .replace(/(?:특별자치도|특별자치시|특별시|광역시|도|시)$/u, '');
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

export function isRecommendableCandidate(
  candidate: Pick<PlaceSearchCandidate, 'name' | 'primaryType'>,
): boolean {
  const type = candidate.primaryType?.toLocaleLowerCase() ?? '';
  const blockedTypes = [
    'airport',
    'bus_station',
    'lodging',
    'subway_station',
    'train_station',
    'transit_station',
    'administrative_area',
    'locality',
  ];
  if (blockedTypes.some((blocked) => type.includes(blocked))) return false;
  return !/(?:역|공항)$/u.test(candidate.name.trim());
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
      startLodging: index === 0 ? null : toLodging(isLodging(first) ? first : primaryLodging),
      endLodging: index === dates.length - 1 ? null : toLodging(isLodging(last) ? last : primaryLodging),
    };
  });
}

export function normalizeGeneratedPlacements(
  placements: AiPlannerOutput['placements'],
  allowedPlaceIds: Set<string>,
  validDates: Set<string>,
): PlannedPlacement[] {
  const seen = new Set<string>();
  return placements.flatMap((placement) => {
    if (!allowedPlaceIds.has(placement.savedPlaceId) || !validDates.has(placement.date) || seen.has(placement.savedPlaceId)) return [];
    seen.add(placement.savedPlaceId);
    const normalized: PlannedPlacement = {
      savedPlaceId: placement.savedPlaceId,
      date: placement.date,
      position: placement.position,
    };
    if (placement.startTime !== undefined) normalized.scheduledTime = placement.startTime;
    if (placement.durationMinutes !== undefined) normalized.durationMinutes = placement.durationMinutes;
    if (placement.activity !== undefined) normalized.activitySummary = placement.activity;
    if (placement.travelMethod !== undefined) normalized.travelMethod = placement.travelMethod;
    if (placement.travelDurationMinutes !== undefined) normalized.travelDurationMinutes = placement.travelDurationMinutes;
    return [normalized];
  });
}

type QualityAssessmentInput = {
  days: AiPlannerDay[];
  style: TravelStyle;
  planningPlaces: SavedPlaceEntity[];
  generated: PlannedPlacement[];
  recommended: PlannedPlacement[];
  locked: Array<{ savedPlaceId: string; date: string | null; position: number | null }>;
  output: AiPlannerOutput;
};

export function assessPlanQuality(input: QualityAssessmentInput): string[] {
  const issues: string[] = [];
  const scheduledIds = new Set([
    ...input.generated.map((item) => item.savedPlaceId),
    ...input.locked.map((item) => item.savedPlaceId),
  ]);
  const unplacedIds = new Set(input.output.unplaced.map((item) => item.savedPlaceId));
  if (input.planningPlaces.some((place) => unplacedIds.has(place.id))) {
    issues.push('saved_places_unplaced');
  }
  const missingSavedPlaces = input.planningPlaces.filter((place) =>
    !scheduledIds.has(place.id) && !unplacedIds.has(place.id),
  );
  if (missingSavedPlaces.length > 0) issues.push('saved_places_missing');
  if (input.planningPlaces.some((place) => place.preference === PlacePreference.MustVisit && !scheduledIds.has(place.id))) {
    issues.push('must_visit_missing');
  }

  const allPlacements = [...input.generated, ...input.recommended];
  for (const day of input.days) {
    const timedVisits = allPlacements
      .filter((item) => item.date === day.date)
      .sort((left, right) => left.position - right.position);
    const lockedVisitCount = input.locked.filter((item) => item.date === day.date).length;
    const plannedMinutes = timedVisits.reduce((total, visit) =>
      total + (visit.durationMinutes ?? 0) + (visit.travelDurationMinutes ?? 0), lockedVisitCount * 110);
    if (plannedMinutes < targetPlannedMinutes(day, input.style)) issues.push(`underfilled_day:${day.date}`);

    let previousEnd: number | undefined;
    for (const visit of timedVisits) {
      if (
        !visit.scheduledTime
        || !visit.durationMinutes
        || !visit.activitySummary?.trim()
        || !visit.travelMethod?.trim()
        || visit.travelDurationMinutes === undefined
      ) {
        issues.push(`schedule_detail_missing:${day.date}`);
        continue;
      }
      if (visit.travelDurationMinutes > 30) issues.push(`long_travel_leg:${day.date}`);
      const start = timeToMinutes(visit.scheduledTime);
      const end = start + visit.durationMinutes;
      if (previousEnd !== undefined && start < previousEnd) {
        issues.push(`invalid_time_window:${day.date}`);
      }
      previousEnd = end;
    }
  }
  return [...new Set(issues)];
}

export function isBlockingQualityIssue(issue: string): boolean {
  return ![
    'long_travel_leg:',
    'underfilled_day:',
  ].some((warningPrefix) => issue.startsWith(warningPrefix));
}

function isRepairableQualityIssue(issue: string): boolean {
  if (issue === 'saved_places_missing' || issue === 'saved_places_unplaced' || issue === 'must_visit_missing') return true;
  return [
    'underfilled_day:',
    'schedule_detail_missing:',
    'invalid_time_window:',
  ].some((prefix) => issue.startsWith(prefix));
}

export function assessRawDayCoverage(
  days: AiPlannerDay[],
  output: AiPlannerOutput,
  style: TravelStyle,
  allowedPlaceIds?: Set<string>,
): string[] {
  return days.flatMap((day) => {
    const visits = [
      ...output.placements.filter((item) =>
        item.date === day.date && (!allowedPlaceIds || allowedPlaceIds.has(item.savedPlaceId)),
      ),
      ...output.recommendations.filter((item) => item.suggestedDate === day.date),
    ];
    const plannedMinutes = visits.reduce((total, visit) =>
      total + (visit.durationMinutes ?? 0) + (visit.travelDurationMinutes ?? 0), 0);
    return plannedMinutes < targetPlannedMinutes(day, style) ? [day.date] : [];
  });
}

export function assessRawOutputContract(
  allowedPlaceIds: Set<string>,
  output: AiPlannerOutput,
): string[] {
  const issues: string[] = [];
  if (output.placements.some((item) => !allowedPlaceIds.has(item.savedPlaceId))) {
    issues.push('unknown_placement_ids');
  }
  if (allowedPlaceIds.size === 0 && output.recommendations.length === 0) {
    issues.push('recommendations_required');
  }
  const returnedPlaceIds = new Set([
    ...output.placements.map((item) => item.savedPlaceId),
    ...output.unplaced.map((item) => item.savedPlaceId),
  ]);
  if ([...allowedPlaceIds].some((id) => !returnedPlaceIds.has(id))) {
    issues.push('saved_places_missing');
  }
  if (output.unplaced.some((item) => allowedPlaceIds.has(item.savedPlaceId))) {
    issues.push('saved_places_unplaced');
  }
  return issues;
}

function formatUnplacedSavedPlaces(output: AiPlannerOutput, places: SavedPlaceEntity[]): string {
  const namesById = new Map(places.map((place) => [place.id, place.name]));
  return output.unplaced
    .map((item) => `${item.savedPlaceId} (${namesById.get(item.savedPlaceId) ?? 'unknown place'})`)
    .join(', ');
}

function minimumPlannedMinutes(style: TravelStyle): number {
  switch (style) {
    case TravelStyle.Relaxed: return 420;
    case TravelStyle.Highlights: return 480;
    case TravelStyle.Balanced:
    case TravelStyle.Food:
    default: return 450;
  }
}

function targetPlannedMinutes(day: AiPlannerDay, style: TravelStyle): number {
  return day.targetPlannedMinutes ?? minimumPlannedMinutes(style);
}

function formatCoverageTargets(days: AiPlannerDay[], dates: string[], style: TravelStyle): string {
  const includedDates = new Set(dates);
  return days
    .filter((day) => includedDates.has(day.date))
    .map((day) => `${day.date}=${targetPlannedMinutes(day, style)} minutes`)
    .join(', ');
}

export function applyDailyPlanningTargets(
  days: AiPlannerDay[],
  style: TravelStyle,
  startPointTime: string | null,
  endPointTime: string | null,
): AiPlannerDay[] {
  const lastIndex = days.length - 1;
  return days.map((day, index) => {
    const availableStart = index === 0 && startPointTime
      ? Math.max(DEFAULT_DAY_START_MINUTES, timeToMinutes(startPointTime))
      : DEFAULT_DAY_START_MINUTES;
    const availableEnd = index === lastIndex && endPointTime
      ? Math.min(DEFAULT_DAY_END_MINUTES, timeToMinutes(endPointTime))
      : DEFAULT_DAY_END_MINUTES;
    const availableMinutes = Math.max(0, availableEnd - availableStart);
    const realisticVisitMinutes = Math.max(0, availableMinutes - BOUNDARY_TRANSITION_BUFFER_MINUTES);
    return {
      ...day,
      targetPlannedMinutes: Math.min(minimumPlannedMinutes(style), realisticVisitMinutes),
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

export function findReusableAiRecommendation<T extends Pick<SavedPlaceEntity, 'googlePlaceId' | 'name' | 'note'>>(
  places: T[],
  candidate: Pick<PlaceSearchCandidate, 'googlePlaceId' | 'name'>,
): T | undefined {
  const candidateName = candidate.name.trim().toLocaleLowerCase();
  return places.find((place) =>
    isAiRecommendedPlace(place)
    && (place.googlePlaceId === candidate.googlePlaceId || place.name.trim().toLocaleLowerCase() === candidateName),
  );
}

function timeToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
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
  locked: Array<{ savedPlaceId: string; date: string | null; position: number | null }>,
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
      if (fixedItem) result.push({ savedPlaceId: fixedItem.savedPlaceId, date, position, locked: true });
      else {
        const item = movable[movableIndex++];
        if (item) result.push({ ...item, position, locked: false });
      }
    }
    return result;
  });
}
