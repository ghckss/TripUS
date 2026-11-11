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
  type AiPlannerOutput,
  type AiPlannerPort,
  AI_PLANNING_TASK,
  TRAVEL_STYLE_POLICIES,
} from '../domain/ai-planner.port';
import { AiPlanGenerationStatus, GenerateAiPlanResponseDto } from './dto/generate-ai-plan.dto';
import { AiPlanningRateLimiter } from './ai-planning-rate-limiter';
import { EntitlementsService } from '../../entitlements/application/entitlements.service';
import { TripDaySettingsService } from '../../trip-day-settings/application/trip-day-settings.service';
import { PlacePreference, PlaceTag } from '../../places/domain/entities/saved-place.entity';
import { PLACE_SEARCH_PORT, type PlaceSearchCandidate, type PlaceSearchPort } from '../../places/domain/place-search.port';
import { ROUTES_PORT, type RoutesPort } from '../../routes/domain/routes.port';
import { AiTransportMode, type GenerateAiPlanDto } from './dto/generate-ai-plan.dto';

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
  private readonly logger = new Logger(AiPlanningService.name);
  constructor(
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(SavedPlaceEntity) private readonly places: Repository<SavedPlaceEntity>,
    @Inject(AI_PLANNER_PORT) private readonly planner: AiPlannerPort,
    @Inject(ItinerariesService) private readonly itineraries: ItinerariesService,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(AiPlanningRateLimiter) private readonly rateLimiter: AiPlanningRateLimiter,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
    @Inject(TripDaySettingsService) private readonly daySettings: TripDaySettingsService,
    @Inject(PLACE_SEARCH_PORT) private readonly placeSearch: PlaceSearchPort,
    @Inject(ROUTES_PORT) private readonly routes: RoutesPort,
  ) {}

  async generate(tripId: string, request: GenerateAiPlanDto): Promise<GenerateAiPlanResponseDto> {
    const { style } = request;
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
      && item.date !== null
      && item.position !== null
      && placesById.get(item.savedPlaceId)?.tag !== PlaceTag.Lodging,
    );
    const lockedIds = new Set(locked.map((item) => item.savedPlaceId));
    const selectedRegions = trip.regions ?? [];
    const planningPlaces = places.filter((place) =>
      place.tag !== PlaceTag.Lodging
      && !lockedIds.has(place.id)
      && isSavedPlaceWithinSelectedRegions(place, selectedRegions),
    );
    if (planningPlaces.length === 0) throw new BadRequestException('Save at least one non-lodging place within the selected regions before generating an itinerary');
    if (planningPlaces.length > 100) throw new BadRequestException('AI planning supports at most 100 saved places');
    const settings = await this.daySettings.get(tripId);
    const days = buildPlannerDays(settings, current.items, places, primaryLodging);
    let createdRecommendationEntities: SavedPlaceEntity[] = [];
    try {
      const output = await this.planner.generate({
        task: AI_PLANNING_TASK,
        trip: {
          title: trip.title,
          destination: trip.destination,
          regions: (trip.regions ?? []).map(({ name, address, latitude, longitude }) => ({ name, address, latitude, longitude })),
          timezone: trip.timezone,
          startDate: trip.startDate,
          endDate: trip.endDate,
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
      });
      this.logger.log(
        `AI itinerary generated placements=${output.placements.length} recommendations=${output.recommendations.length}`
        + (output.usage ? ` inputTokens=${output.usage.inputTokens} outputTokens=${output.usage.outputTokens}` : ''),
      );
      const validDates = new Set(days.map((day) => day.date));
      const materialized = await this.materializeRecommendations(
        trip.id,
        trip.destination,
        selectedRegions,
        output.recommendations,
        places,
        validDates,
      );
      createdRecommendationEntities = materialized.created;
      const recommended = materialized.placements;
      this.logger.log(`AI recommendations materialized received=${output.recommendations.length} saved=${recommended.length}`);
      const allowed = new Set([...planningPlaces.map((place) => place.id), ...recommended.map((item) => item.savedPlaceId)]);
      const generated = normalizeGeneratedPlacements(output.placements, allowed, validDates);
      const verifiedPlanBs = await this.verifyPlanBs(output.planBs, trip.destination, selectedRegions, validDates);
      const qualityIssues = assessPlanQuality({
        days,
        style: TRAVEL_STYLE_POLICIES[style],
        planningPlaces,
        generated,
        recommended,
        locked,
        output,
        verifiedPlanBs,
        recommendedPlaces: materialized.created,
      });
      if (qualityIssues.length > 0) {
        if (createdRecommendationEntities.length > 0) await this.places.remove(createdRecommendationEntities);
        createdRecommendationEntities = [];
        this.logger.warn(`AI itinerary rejected quality=${qualityIssues.join(',')}`);
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
      if (result.status === ItineraryUpdateStatus.Updated) {
        await this.daySettings.applyAiPlanBs(tripId, verifiedPlanBs);
        await this.entitlements.recordSuccessfulAiGeneration();
      } else if (createdRecommendationEntities.length > 0) {
        await this.places.remove(createdRecommendationEntities);
        createdRecommendationEntities = [];
      }
      return {
        status: result.status === ItineraryUpdateStatus.Updated ? AiPlanGenerationStatus.Generated : AiPlanGenerationStatus.Conflict,
        style,
        conflicts: result.conflicts,
        itinerary: result.itinerary,
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
      this.logger.warn(`AI itinerary unavailable reason=${reason}`);
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
    selectedRegions: Array<{ name: string }>,
    recommendations: AiPlannerOutput['recommendations'],
    existingPlaces: SavedPlaceEntity[],
    validDates: Set<string>,
  ): Promise<{ placements: PlannedPlacement[]; created: SavedPlaceEntity[] }> {
    const knownGoogleIds = new Set(existingPlaces.flatMap((place) => place.googlePlaceId ? [place.googlePlaceId] : []));
    const knownNames = new Set(existingPlaces.map((place) => place.name.trim().toLocaleLowerCase()));
    const placements: PlannedPlacement[] = [];
    const created: SavedPlaceEntity[] = [];

    for (const recommendation of recommendations) {
      if (!validDates.has(recommendation.suggestedDate)) continue;
      try {
        const candidates = await this.placeSearch.search(
          recommendation.placeName,
          `${recommendation.regionName}, ${destination}`,
        );
        const uniqueCandidates = candidates.filter((item) =>
          !knownGoogleIds.has(item.googlePlaceId)
          && !knownNames.has(item.name.trim().toLocaleLowerCase()),
        );
        const candidate = uniqueCandidates.find((item) =>
          isWithinSelectedRegions(recommendation.regionName, item, selectedRegions)
          && isRecommendableCandidate(item),
        );
        if (!candidate) {
          const reason = uniqueCandidates.length === 0 ? 'not_found_or_duplicate' : 'outside_selected_regions';
          this.logger.warn(`AI recommendation rejected reason=${reason} name=${recommendation.placeName}`);
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
        knownNames.add(candidate.name.trim().toLocaleLowerCase());
        created.push(entity);
        placements.push({
          savedPlaceId: entity.id,
          date: recommendation.suggestedDate,
          position: recommendation.position,
          scheduledTime: recommendation.startTime,
          durationMinutes: recommendation.durationMinutes,
          activitySummary: recommendation.activity,
          travelMethod: recommendation.travelMethod,
          travelDurationMinutes: recommendation.travelDurationMinutes,
        });
      } catch {
        this.logger.warn(`AI recommended place could not be verified name=${recommendation.placeName}`);
      }
    }
    return { placements, created };
  }

  private async verifyPlanBs(
    planBs: AiPlannerOutput['planBs'],
    destination: string,
    selectedRegions: Array<{ name: string }>,
    validDates: Set<string>,
  ): Promise<Array<{ date: string; placeName: string; address: string | null; reason: string }>> {
    const verified = [];
    for (const planB of planBs) {
      if (!validDates.has(planB.date)) continue;
      try {
        const candidates = await this.placeSearch.search(planB.placeName, `${planB.regionName}, ${destination}`);
        const candidate = candidates.find((item) =>
          isWithinSelectedRegions(planB.regionName, item, selectedRegions)
          && isRecommendableCandidate(item),
        );
        if (candidate) verified.push({ date: planB.date, placeName: candidate.name, address: candidate.address, reason: planB.reason });
      } catch {
        this.logger.warn(`AI Plan B could not be verified name=${planB.placeName}`);
      }
    }
    return verified;
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
  _recommendationRegionName: string,
  candidate: Pick<PlaceSearchCandidate, 'name' | 'address'>,
  selectedRegions: Array<{ name: string }>,
): boolean {
  if (selectedRegions.length === 0) return true;
  const candidateLocation = normalizeRegionName(`${candidate.name} ${candidate.address ?? ''}`);
  return selectedRegions.some(({ name }) => candidateLocation.includes(normalizeRegionName(name)));
}

export function isSavedPlaceWithinSelectedRegions(
  place: Pick<SavedPlaceEntity, 'name' | 'address'>,
  selectedRegions: Array<{ name: string }>,
): boolean {
  if (selectedRegions.length === 0) return true;
  const placeLocation = normalizeRegionName(`${place.name} ${place.address ?? ''}`);
  return selectedRegions.some(({ name }) => placeLocation.includes(normalizeRegionName(name)));
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
  settings: Array<{ date: string; startTime: string; endTime: string }>,
  itineraryItems: Array<{ savedPlaceId: string; date: string | null; position: number | null }>,
  places: Array<Pick<SavedPlaceEntity, 'id' | 'name' | 'address' | 'latitude' | 'longitude' | 'tag' | 'isPrimaryLodging'>>,
  primaryLodging?: Pick<SavedPlaceEntity, 'id' | 'name' | 'address' | 'latitude' | 'longitude' | 'tag' | 'isPrimaryLodging'>,
): AiPlannerDay[] {
  const placesById = new Map(places.map((place) => [place.id, place]));
  return settings.map((setting) => {
    const items = itineraryItems
      .filter((item) => item.date === setting.date && item.position !== null)
      .sort((left, right) => left.position! - right.position!);
    const first = placesById.get(items[0]?.savedPlaceId ?? '');
    const last = placesById.get(items.at(-1)?.savedPlaceId ?? '');
    return {
      ...setting,
      startLodging: toLodging(isLodging(first) ? first : primaryLodging),
      endLodging: toLodging(isLodging(last) ? last : primaryLodging),
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
  style: { recommendedPlacesPerDay: number };
  planningPlaces: SavedPlaceEntity[];
  generated: PlannedPlacement[];
  recommended: PlannedPlacement[];
  locked: Array<{ savedPlaceId: string; date: string | null; position: number | null }>;
  output: AiPlannerOutput;
  verifiedPlanBs: Array<{ date: string }>;
  recommendedPlaces: SavedPlaceEntity[];
};

export function assessPlanQuality(input: QualityAssessmentInput): string[] {
  const issues: string[] = [];
  const scheduledIds = new Set([
    ...input.generated.map((item) => item.savedPlaceId),
    ...input.locked.map((item) => item.savedPlaceId),
  ]);
  const unplacedIds = new Set(input.output.unplaced.map((item) => item.savedPlaceId));
  const missingSavedPlaces = input.planningPlaces.filter((place) =>
    !scheduledIds.has(place.id) && !unplacedIds.has(place.id),
  );
  if (missingSavedPlaces.length > 0) issues.push('saved_places_missing');
  if (input.planningPlaces.some((place) => place.preference === PlacePreference.MustVisit && !scheduledIds.has(place.id))) {
    issues.push('must_visit_missing');
  }

  const knownPlaces = new Map(
    [...input.planningPlaces, ...input.recommendedPlaces].map((place) => [place.id, place]),
  );
  const allPlacements = [...input.generated, ...input.recommended];
  for (const day of input.days) {
    const visits = [
      ...allPlacements.filter((item) => item.date === day.date),
      ...input.locked.filter((item) => item.date === day.date).map((item) => ({
        savedPlaceId: item.savedPlaceId,
        date: item.date!,
        position: item.position!,
      })),
    ];
    const meaningfulVisitCount = visits.filter((item) => knownPlaces.get(item.savedPlaceId)?.tag !== PlaceTag.Transport).length;
    const availableMinutes = timeToMinutes(day.endTime) - timeToMinutes(day.startTime);
    const densityTarget = Math.min(input.style.recommendedPlacesPerDay, Math.max(1, Math.floor(availableMinutes / 180)));
    if (meaningfulVisitCount < densityTarget) issues.push(`underfilled_day:${day.date}`);
    if (!input.verifiedPlanBs.some((planB) => planB.date === day.date)) issues.push(`plan_b_missing:${day.date}`);

    const timedVisits = allPlacements
      .filter((item) => item.date === day.date)
      .sort((left, right) => left.position - right.position);
    let previousEnd = timeToMinutes(day.startTime);
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
      if (
        start < timeToMinutes(day.startTime)
        || end > timeToMinutes(day.endTime)
        || start < previousEnd + (visit.travelDurationMinutes ?? 0)
      ) {
        issues.push(`invalid_time_window:${day.date}`);
      }
      previousEnd = end;
    }
  }
  return [...new Set(issues)];
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
