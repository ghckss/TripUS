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
  type AiPlannerReview,
  type AiPlannerReviewFocus,
  type AiVisitTimeSlot,
  AI_PLANNING_TASK,
  TRAVEL_DENSITY_POLICIES,
  TravelDensity,
  TravelTheme,
} from '../domain/ai-planner.port';
import {
  AiPlanGenerationStatus,
  GenerateAiPlanResponseDto,
  LatestAiPlanRequestResponseDto,
} from './dto/generate-ai-plan.dto';
import { AiPlanningRateLimiter } from './ai-planning-rate-limiter';
import { EntitlementsService } from '../../entitlements/application/entitlements.service';
import { PlacePreference, PlaceTag } from '../../places/domain/entities/saved-place.entity';
import {
  PLACE_SEARCH_PORT,
  type PlaceOpeningPeriod,
  type PlaceSchedulingDetails,
  type PlaceSearchCandidate,
  type PlaceSearchPort,
} from '../../places/domain/place-search.port';
import { ROUTES_PORT, type RoutesPort } from '../../routes/domain/routes.port';
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
  preferredTimeSlot?: AiVisitTimeSlot;
  fixedSchedule?: boolean;
};

const MAX_PLANNER_ATTEMPTS = 3;
const MAX_MATERIALIZATION_ATTEMPTS = 4;
const DEFAULT_DAY_START_MINUTES = 9 * 60;
const DEFAULT_DAY_END_MINUTES = 21 * 60;
const BOUNDARY_TRANSITION_BUFFER_MINUTES = 60;
const PARTIAL_DAY_TARGET_UTILIZATION = 0.85;
const FINAL_REVIEW_FOCUSES: AiPlannerReviewFocus[] = ['route_time', 'traveler_intent', 'meal_density'];

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

  async getLatestRequest(tripId: string): Promise<LatestAiPlanRequestResponseDto> {
    const trip = await this.trips.findOneBy({
      id: tripId,
      ownerId: this.identity.getCurrentUserId(),
      active: true,
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return { request: normalizeLatestAiPlanRequest(trip.latestAiPlanRequest) };
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
    const { density } = request;
    const generationId = randomUUID();
    const startedAt = performance.now();
    this.rateLimiter.assertAllowed(this.identity.getCurrentUserId());
    await this.entitlements.assertCanGenerateAiPlan();
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!targetDate) {
      trip.latestAiPlanRequest = { ...request };
      await this.trips.save(trip);
    }
    const places = await this.places.find({ where: { tripId }, order: { createdAt: 'ASC' } });
    const primaryLodging = places.find((place) => place.isPrimaryLodging);
    const current = await this.itineraries.get(tripId);
    const placesById = new Map(places.map((place) => [place.id, place]));
    const targetDatePlaceIds = new Set(current.items
      .filter((item) => !targetDate || item.date === targetDate)
      .map((item) => item.savedPlaceId));
    const otherDatePlaceIds = new Set(current.items
      .filter((item) => targetDate && item.date !== targetDate)
      .map((item) => item.savedPlaceId));
    const currentlyPlacedIds = new Set(current.items.map((item) => item.savedPlaceId));
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
    const previousAiRecommendations = places.filter(isAiRecommendedPlace);
    const selectedRegions = trip.regions ?? [];
    const planningPlaces = places.filter((place) =>
      place.tag !== PlaceTag.Lodging
      && !lockedIds.has(place.id)
      && !isAiRecommendedPlace(place)
      && (!targetDate || targetDatePlaceIds.has(place.id)),
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
    const schedulingDetailsCache = new Map<string, PlaceSchedulingDetails | null>();
    const planningSchedulingDetails = await this.loadSchedulingDetails(planningPlaces, schedulingDetailsCache);
    const days = applyDailyPlanningTargets(
      buildPlannerDays(enumerateTripDates(trip.startDate, trip.endDate), current.items, places, primaryLodging),
      density,
      trip.startPoint?.time ?? null,
      trip.endPoint?.time ?? null,
    ).filter((day) => !targetDate || day.date === targetDate);
    let createdRecommendationEntities: SavedPlaceEntity[] = [];
    try {
      writeStructuredLog('info', 'ai.generation.started', {
        generationId,
        tripId,
        dayCount: days.length,
        savedPlaceCount: planningPlaces.length,
        density,
        themes: request.themes,
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
        density: TRAVEL_DENSITY_POLICIES[density],
        travelerContext: {
          companions: request.companions?.trim() || null,
          transportModes: request.transportModes,
          budgetLevel: request.budgetLevel ?? null,
          themes: request.themes,
          additionalRequests: request.additionalRequests?.trim() || null,
          requiredActivityRequests: extractRequiredActivityRequests(request.additionalRequests ?? ''),
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
          primaryType: planningSchedulingDetails.get(place.id)?.primaryType ?? null,
          regularOpeningHours: planningSchedulingDetails.get(place.id)?.regularOpeningHours ?? null,
        })),
        days,
        referenceItinerary: targetDate
          ? buildReferenceItinerary(current.items, placesById, targetDate)
          : [],
        lockedPlacements: locked.map((item) => ({ savedPlaceId: item.savedPlaceId, date: item.date!, position: item.position! })),
        priorRecommendations: previousAiRecommendations.map((place) => place.name),
      };
      let output = await this.planner.generate(plannerInput);
      const allowedPlannerPlaceIds = new Set(planningPlaces.map((place) => place.id));
      const placeNamesById = new Map(places.map((place) => [place.id, place.name]));
      const lockedPlannerPlaceIds = new Set(locked.map((item) => item.savedPlaceId));
      for (let attempt = 1; attempt < MAX_PLANNER_ATTEMPTS; attempt += 1) {
        const outputContractIssues = assessRawOutputContract(allowedPlannerPlaceIds, output);
        const coverageIssues = assessRawDayCoverage(days, output, density, allowedPlannerPlaceIds);
        const explicitRequestIssues = assessExplicitRequestCoverage(
          plannerInput.travelerContext.requiredActivityRequests,
          output,
          placeNamesById,
          lockedPlannerPlaceIds,
        );
        if (outputContractIssues.length === 0 && coverageIssues.length === 0 && explicitRequestIssues.length === 0) break;
        writeStructuredLog('warn', 'ai.generation.draft_revision', {
          generationId,
          tripId,
          attempt,
          maxAttempts: MAX_PLANNER_ATTEMPTS,
          contractIssues: outputContractIssues,
          underfilledDates: coverageIssues,
          explicitRequestIssues,
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
              `Required totals by date are: ${formatCoverageTargets(days, coverageIssues, density)}.`,
              'Update the entire itinerary by adding nearby recommendations, meals, cafes, and activities so each listed date reaches that total without rushing.',
              'Keep previous recommendations that are still optimal, but add or replace places as needed. Return the complete revised itinerary, not only the added visits.',
            ]
            : []),
          ...(explicitRequestIssues.length > 0
            ? [formatExplicitRequestRevisionGuidance(
              plannerInput.travelerContext.requiredActivityRequests,
              explicitRequestIssues,
            )]
            : []),
        ];
        output = await this.planner.generate({
          ...plannerInput,
          revisionDraft: toRevisionDraft(output),
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
      let recommended: PlannedPlacement[];
      let qualityIssues: string[];
      let finalReviewCompleted = false;
      for (let materializationAttempt = 1; ; materializationAttempt += 1) {
        materialized = await this.materializeRecommendations(
          trip.id,
          trip.destination,
          recommendationRegions,
          output.recommendations,
          places,
          validDates,
          request.additionalRequests?.trim() ?? '',
          otherDatePlaceIds,
          buildOptionalStopUsage(
            [...output.placements, ...locked.map((item) => ({ savedPlaceId: item.savedPlaceId, date: item.date! }))],
            placesById,
            validDates,
          ),
        );
        createdRecommendationEntities = materialized.created;
        const allowed = new Set([...planningPlaces.map((place) => place.id), ...materialized.placements.map((item) => item.savedPlaceId)]);
        generated = normalizeGeneratedPlacements(output.placements, allowed, validDates);
        let allPlanningPlaces = [...places, ...materialized.created];
        let placeTagsById = await this.resolveActualPlaceTags(
          allPlanningPlaces,
          new Set([...generated, ...materialized.placements, ...locked].map((item) => item.savedPlaceId)),
        );
        const missingMeals = assessMissingMeals(
          days,
          [...generated, ...materialized.placements],
          locked,
          placeTagsById,
        );
        if (missingMeals.length > 0) {
          const supplement = await this.supplementMissingMeals({
            tripId: trip.id,
            destination: trip.destination,
            selectedRegions: recommendationRegions,
            days,
            missingMeals,
            placements: [...generated, ...materialized.placements],
            locked,
            places: allPlanningPlaces,
            transportModes: request.transportModes,
            additionalRequests: request.additionalRequests?.trim() ?? '',
          });
          materialized.created.push(...supplement.created);
          materialized.placements.push(...supplement.placements);
          if (supplement.placements.length > 0) {
            writeStructuredLog('info', 'ai.generation.meals_supplemented', {
              generationId,
              tripId,
              meals: supplement.placements.map((item) => ({
                date: item.date,
                scheduledTime: item.scheduledTime,
                savedPlaceId: item.savedPlaceId,
              })),
            });
          }
          allPlanningPlaces = [...places, ...materialized.created];
          placeTagsById = new Map(allPlanningPlaces.map((place) => [place.id, place.tag]));
        }
        const generatedIdsBeforeScheduling = new Set(generated.map((item) => item.savedPlaceId));
        const scheduleDetailsByPlaceId = await this.loadSchedulingDetails(allPlanningPlaces, schedulingDetailsCache);
        const preferredPlacements = applyVisitTimePreferences(
          [...generated, ...materialized.placements],
          new Map(allPlanningPlaces.map((place) => [place.id, place])),
          plannerInput.travelerContext.requiredActivityRequests,
        );
        const openingHoursAdjustedPlacements = applyOpeningHoursPreferences(
          preferredPlacements,
          scheduleDetailsByPlaceId,
        );
        const scheduledPlacements = reindexPlacementsByTime(openingHoursAdjustedPlacements);
        generated = scheduledPlacements.filter((item) => generatedIdsBeforeScheduling.has(item.savedPlaceId));
        materialized.placements = scheduledPlacements.filter((item) => !generatedIdsBeforeScheduling.has(item.savedPlaceId));
        const routeCheckedPlacements = await this.enrichTravelEstimates(
          addLodgingEndpoints(
            mergeLockedPlacements(locked, [...generated, ...materialized.placements]),
            days,
          ),
          allPlanningPlaces,
          request.transportModes,
        );
        generated = applyEnrichedTravelEstimates(generated, routeCheckedPlacements);
        recommended = applyEnrichedTravelEstimates(materialized.placements, routeCheckedPlacements);
        const generatedIds = new Set(generated.map((item) => item.savedPlaceId));
        const normalizedSchedule = normalizeVisitSchedule([...generated, ...recommended], days, generatedIds);
        generated = normalizedSchedule.filter((item) => generatedIds.has(item.savedPlaceId));
        recommended = normalizedSchedule.filter((item) => !generatedIds.has(item.savedPlaceId));
        qualityIssues = assessPlanQuality({
          days,
          density,
          planningPlaces,
          generated,
          recommended,
          locked,
          placeTagsById,
          output,
        });
        qualityIssues.push(...assessExplicitRequestCoverage(
          plannerInput.travelerContext.requiredActivityRequests,
          output,
          placeNamesById,
          lockedPlannerPlaceIds,
        ));
        qualityIssues.push(...assessTimeSuitability([...generated, ...recommended]));
        qualityIssues.push(...assessOpeningHours(
          [...generated, ...recommended],
          scheduleDetailsByPlaceId,
        ));
        qualityIssues = [...new Set(qualityIssues)];
        const repairableIssues = qualityIssues.filter(isRepairableQualityIssue);
        if (repairableIssues.length === 0 && !finalReviewCompleted && materializationAttempt < MAX_MATERIALIZATION_ATTEMPTS) {
          const materializedDraft = toMaterializedReviewDraft(
            generated,
            recommended,
            new Map(allPlanningPlaces.map((place) => [place.id, place])),
            output,
          );
          if (createdRecommendationEntities.length > 0) await this.places.remove(createdRecommendationEntities);
          createdRecommendationEntities = [];
          output = await this.runOrchestratedFinalReview(generationId, tripId, plannerInput, materializedDraft);
          finalReviewCompleted = true;
          continue;
        }
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
          revisionDraft: toRevisionDraft(output),
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
            repairableIssues.some((issue) => issue.startsWith('missing_meal:'))
              ? 'Add a real restaurant for every missing breakfast, lunch, or dinner slot. Cafes and dessert shops do not count as meals.'
              : '',
            repairableIssues.some((issue) => issue.startsWith('required_activity_'))
              ? formatExplicitRequestRevisionGuidance(
                plannerInput.travelerContext.requiredActivityRequests,
                repairableIssues,
              )
              : '',
            repairableIssues.some((issue) => issue.startsWith('time_slot_mismatch:'))
              ? 'Move each time_slot_mismatch visit into its preferredTimeSlot and reorder nearby visits around that anchor. Night views, observation decks, Ferris wheels, and night markets must not be scheduled in the morning.'
              : '',
            repairableIssues.some((issue) => issue.startsWith('closed_place:'))
              ? 'One or more verified places are closed at the proposed time. Move them inside the supplied regularOpeningHours or replace optional recommendations with open alternatives.'
              : '',
            `Required totals by date are: ${formatCoverageTargets(days, days.map((day) => day.date), density)}.`,
            'Return the complete corrected itinerary. Keep valid saved-place placements, replace unverifiable recommendations, and use chronological non-overlapping times.',
          ].filter(Boolean).join(' '),
        });
      }
      const reusedRecommendationIds = new Set(recommended.map((item) => item.savedPlaceId));
      const staleAiRecommendations = previousAiRecommendations.filter((place) =>
        currentlyPlacedIds.has(place.id)
        && (!targetDate || targetDatePlaceIds.has(place.id))
        && (!targetDate || !otherDatePlaceIds.has(place.id))
        && !lockedIds.has(place.id) && !reusedRecommendationIds.has(place.id),
      );
      writeStructuredLog('info', 'ai.generation.recommendations_materialized', {
        generationId,
        tripId,
        received: output.recommendations.length,
        saved: recommended.length,
        rejected: materialized.rejected,
      });
      const blockingQualityIssues = qualityIssues.filter(isBlockingQualityIssue);
      const nonBlockingQualityIssues = qualityIssues.filter((issue) => !isBlockingQualityIssue(issue));
      if (nonBlockingQualityIssues.length > 0) {
        writeStructuredLog('warn', 'ai.generation.accepted_with_warnings', {
          generationId,
          tripId,
          issues: nonBlockingQualityIssues,
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
        throw new AiPlannerError('invalid_output', { issues: blockingQualityIssues });
      }
      const savedSuggestions = await this.materializeSavedRecommendations(
        trip.id,
        trip.destination,
        recommendationRegions,
        output.savedRecommendations ?? [],
        [...places, ...materialized.created],
        request.additionalRequests?.trim() ?? '',
      );
      createdRecommendationEntities.push(...savedSuggestions.created);
      writeStructuredLog('info', 'ai.generation.saved_recommendations_materialized', {
        generationId,
        tripId,
        received: output.savedRecommendations?.length ?? 0,
        saved: savedSuggestions.created.length,
        rejected: savedSuggestions.rejected,
      });
      const placementsWithLodging = addLodgingEndpoints(
        mergeLockedPlacements(locked, [...generated, ...recommended]),
        days,
      );
      const placements = await this.enrichTravelEstimates(
        placementsWithLodging,
        [...places, ...materialized.created],
        request.transportModes,
      );
      const persistedPlacements = placements.map((placement) => ({
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
        ? await this.itineraries.replaceDay(tripId, targetDate, persistedPlacements, ItinerarySource.Ai)
        : await this.itineraries.replace(tripId, persistedPlacements, ItinerarySource.Ai);
      let finalItinerary = result.itinerary;
      if (result.status === ItineraryUpdateStatus.Updated) {
        await this.applyMissingPlaceDescriptions(places, output.placeDescriptions ?? []);
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
        placementCount: persistedPlacements.length,
      });
      return {
        status: result.status === ItineraryUpdateStatus.Updated ? AiPlanGenerationStatus.Generated : AiPlanGenerationStatus.Conflict,
        density,
        themes: request.themes,
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
        density,
        themes: request.themes,
        conflicts: [],
        itinerary: await this.itineraries.get(tripId),
        failureReason: reason,
      };
    }
  }

  private async applyMissingPlaceDescriptions(
    existingPlaces: SavedPlaceEntity[],
    descriptions: NonNullable<AiPlannerOutput['placeDescriptions']>,
  ): Promise<void> {
    const descriptionsById = new Map(descriptions.map((item) => [item.savedPlaceId, sanitizePlaceDescription(item.description)]));
    const updates = existingPlaces.filter((place) => {
      if (place.note?.trim()) return false;
      const description = descriptionsById.get(place.id);
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

  private async runOrchestratedFinalReview(
    generationId: string,
    tripId: string,
    plannerInput: AiPlannerInput,
    draft: Omit<AiPlannerOutput, 'usage'>,
  ): Promise<AiPlannerOutput> {
    const startedAt = performance.now();
    writeStructuredLog('info', 'ai.generation.parallel_review_started', {
      generationId,
      tripId,
      focuses: FINAL_REVIEW_FOCUSES,
    });

    let reviews: AiPlannerReview[] = [];
    let failedFocuses: AiPlannerReviewFocus[] = [];
    if (this.planner.review) {
      const review = this.planner.review.bind(this.planner);
      const settled = await Promise.allSettled(
        FINAL_REVIEW_FOCUSES.map((focus) => review(plannerInput, draft, focus)),
      );
      reviews = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      failedFocuses = settled.flatMap((result, index) =>
        result.status === 'rejected' ? [FINAL_REVIEW_FOCUSES[index]!] : [],
      );
    }

    writeStructuredLog(failedFocuses.length > 0 ? 'warn' : 'info', 'ai.generation.parallel_review_completed', {
      generationId,
      tripId,
      completedFocuses: reviews.map((review) => review.focus),
      failedFocuses,
      issueCount: reviews.reduce((count, review) => count + review.issues.length, 0),
      blockingIssueCount: reviews.reduce(
        (count, review) => count + review.issues.filter((issue) => issue.severity === 'blocking').length,
        0,
      ),
      inputTokens: reviews.reduce((count, review) => count + (review.usage?.inputTokens ?? 0), 0),
      outputTokens: reviews.reduce((count, review) => count + (review.usage?.outputTokens ?? 0), 0),
      durationMs: Math.round(performance.now() - startedAt),
    });

    try {
      writeStructuredLog('info', 'ai.generation.review_integration_started', { generationId, tripId });
      const integrated = await this.planner.generate({
        ...plannerInput,
        revisionDraft: draft,
        orchestrationReviews: reviews,
        revisionGuidance: [
          '최종 통합 단계다. Google 장소 검증, 실제 이동시간, 영업시간과 서버 시간대 보정까지 반영된 직전 일정과 병렬 전문 검토 결과를 함께 검토한다.',
          '모든 blocking 문제를 해결하고, 사용자 명시 요청과 저장 장소는 유지하며, 문제가 없는 일정은 불필요하게 바꾸지 않는다.',
          '전망대·관람차·야경 명소는 일몰 이후, 야시장은 저녁, 아침 전문점은 오전에 배치한다. 시간이 부족하면 체류시간을 비현실적으로 줄이지 말고 중요도가 낮은 AI 추천 장소를 제거한다.',
          '검토 의견이 없거나 일부 검토가 실패했더라도 직전 일정 전체를 직접 확인하고 수정된 완전한 일정만 반환한다.',
        ].join(' '),
      });
      writeStructuredLog('info', 'ai.generation.review_integration_completed', {
        generationId,
        tripId,
        reviewCount: reviews.length,
        inputTokens: integrated.usage?.inputTokens ?? 0,
        outputTokens: integrated.usage?.outputTokens ?? 0,
      });
      return integrated;
    } catch (error) {
      writeStructuredLog('warn', 'ai.generation.review_integration_fallback', {
        generationId,
        tripId,
        reviewCount: reviews.length,
        reason: error instanceof AiPlannerError ? error.reason : 'provider_failure',
      });
      return draft;
    }
  }

  private async loadSchedulingDetails(
    places: SavedPlaceEntity[],
    cache: Map<string, PlaceSchedulingDetails | null>,
  ): Promise<Map<string, PlaceSchedulingDetails | null>> {
    const detailsByPlaceId = new Map<string, PlaceSchedulingDetails | null>();
    await mapWithConcurrency(places, 6, async (place) => {
      if (!place.googlePlaceId || !this.placeSearch.getSchedulingDetails) {
        detailsByPlaceId.set(place.id, null);
        return;
      }
      if (!cache.has(place.googlePlaceId)) {
        try {
          cache.set(place.googlePlaceId, await this.placeSearch.getSchedulingDetails(place.googlePlaceId));
        } catch {
          cache.set(place.googlePlaceId, null);
          this.logger.warn(`Place scheduling details unavailable placeId=${place.id}`);
        }
      }
      detailsByPlaceId.set(place.id, cache.get(place.googlePlaceId) ?? null);
    });
    return detailsByPlaceId;
  }

  private async resolveActualPlaceTags(
    places: SavedPlaceEntity[],
    relevantPlaceIds: Set<string>,
  ): Promise<Map<string, PlaceTag>> {
    const tags = new Map(places.map((place) => [place.id, place.tag]));
    if (!this.placeSearch.getPrimaryType) return tags;
    await Promise.all(places.map(async (place) => {
      if (place.tag !== PlaceTag.Other || !place.googlePlaceId || !relevantPlaceIds.has(place.id)) return;
      try {
        const primaryType = await this.placeSearch.getPrimaryType!(place.googlePlaceId);
        if (recommendationTag({ primaryType } as PlaceSearchCandidate) !== PlaceTag.Food) return;
        tags.set(place.id, PlaceTag.Food);
        place.tag = PlaceTag.Food;
        await this.places.save(place);
      } catch {
        this.logger.warn(`Place type recheck unavailable placeId=${place.id}`);
      }
    }));
    return tags;
  }

  private async supplementMissingMeals(input: {
    tripId: string;
    destination: string;
    selectedRegions: Array<{ name: string; latitude?: number | null; longitude?: number | null }>;
    days: AiPlannerDay[];
    missingMeals: string[];
    placements: PlannedPlacement[];
    locked: Array<{ savedPlaceId: string; date: string | null; position: number | null; scheduledTime?: string | null }>;
    places: SavedPlaceEntity[];
    transportModes: AiTransportMode[];
    additionalRequests: string;
  }): Promise<{ created: SavedPlaceEntity[]; placements: PlannedPlacement[] }> {
    const created: SavedPlaceEntity[] = [];
    const placements: PlannedPlacement[] = [];
    const placesById = new Map(input.places.map((place) => [place.id, place]));
    const usedGoogleIds = new Set(input.places.flatMap((place) => place.googlePlaceId ? [place.googlePlaceId] : []));
    const usedNames = new Set(input.places.map((place) => place.name.trim().toLocaleLowerCase()));

    for (const issue of input.missingMeals) {
      const parsed = parseMissingMealIssue(issue);
      if (!parsed) continue;
      const day = input.days.find((candidate) => candidate.date === parsed.date);
      if (!day) continue;
      const scheduledTime = suggestedMealTime(day, parsed.meal);
      if (!scheduledTime) continue;
      const dayAnchor = [...input.placements, ...input.locked]
        .filter((item) => item.date === parsed.date)
        .map((item) => placesById.get(item.savedPlaceId))
        .find((place) => place?.address);
      const regionContext = dayAnchor?.address ?? input.selectedRegions[0]?.name ?? input.destination;
      try {
        const candidates = await this.placeSearch.search(`${mealLabel(parsed.meal)} 식사 식당`, regionContext);
        let selected: PlaceSearchCandidate | undefined;
        for (const candidate of candidates) {
          if (usedGoogleIds.has(candidate.googlePlaceId) || usedNames.has(candidate.name.trim().toLocaleLowerCase())) continue;
          let verified = candidate;
          if (recommendationTag(candidate) === PlaceTag.Other && this.placeSearch.getPrimaryType) {
            const primaryType = await this.placeSearch.getPrimaryType(candidate.googlePlaceId);
            verified = { ...candidate, primaryType };
          }
          if (
            recommendationTag(verified) === PlaceTag.Food
            && isRecommendableCandidate(verified, input.destination, input.additionalRequests)
            && isWithinSelectedRegions(regionContext, verified, input.selectedRegions)
          ) {
            selected = verified;
            break;
          }
        }
        if (!selected) {
          this.logger.warn(`Meal supplement unavailable date=${parsed.date} meal=${parsed.meal}`);
          continue;
        }
        const entity = await this.places.save(this.places.create({
          tripId: input.tripId,
          googlePlaceId: selected.googlePlaceId,
          name: selected.name,
          address: selected.address,
          latitude: selected.latitude,
          longitude: selected.longitude,
          tag: PlaceTag.Food,
          preference: PlacePreference.IfTimeAllows,
          note: `AI 추천 · ${mealLabel(parsed.meal)} 일정 보완`,
          isPrimaryLodging: false,
        }));
        usedGoogleIds.add(selected.googlePlaceId);
        usedNames.add(selected.name.trim().toLocaleLowerCase());
        created.push(entity);
        placements.push({
          savedPlaceId: entity.id,
          date: parsed.date,
          position: 0,
          scheduledTime,
          durationMinutes: 60,
          activitySummary: `${mealLabel(parsed.meal)} 식사`,
          travelMethod: preferredTravelMethod(input.transportModes),
          travelDurationMinutes: 0,
          preferredTimeSlot: parsed.meal === 'breakfast' ? 'morning' : parsed.meal === 'lunch' ? 'lunch' : 'evening',
        });
      } catch {
        this.logger.warn(`Meal supplement failed date=${parsed.date} meal=${parsed.meal}`);
      }
    }
    return { created, placements };
  }

  private async materializeRecommendations(
    tripId: string,
    destination: string,
    selectedRegions: Array<{ name: string; latitude?: number | null; longitude?: number | null }>,
    recommendations: AiPlannerOutput['recommendations'],
    existingPlaces: SavedPlaceEntity[],
    validDates: Set<string>,
    additionalRequests: string,
    otherDatePlaceIds: Set<string>,
    initialOptionalStopUsage: Map<string, Set<OptionalStopCategory>>,
  ): Promise<{
    placements: PlannedPlacement[];
    created: SavedPlaceEntity[];
    rejected: Array<{ placeName: string; suggestedDate: string; reason: string }>;
  }> {
    const knownGoogleIds = new Set(existingPlaces.flatMap((place) => place.googlePlaceId ? [place.googlePlaceId] : []));
    const knownNames = new Set(existingPlaces.map((place) => place.name.trim().toLocaleLowerCase()));
    const placements: PlannedPlacement[] = [];
    const created: SavedPlaceEntity[] = [];
    const placedDatesById = new Map<string, Set<string>>();
    const newlyCreatedByGoogleId = new Map<string, SavedPlaceEntity>();
    const optionalStopUsage = new Map(
      [...initialOptionalStopUsage].map(([date, categories]) => [date, new Set(categories)]),
    );
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
          && isRecommendableCandidate(item, destination, additionalRequests),
        );
        if (!candidate) {
          this.logger.warn(`AI recommendation rejected reason=not_found_or_outside_region name=${recommendation.placeName}`);
          rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: 'not_found_or_outside_region' });
          continue;
        }
        const normalizedCandidateName = candidate.name.trim().toLocaleLowerCase();
        const priorAiPlace = findReusableAiRecommendation(existingPlaces, candidate)
          ?? newlyCreatedByGoogleId.get(candidate.googlePlaceId);
        if (priorAiPlace) {
          const scheduledDates = placedDatesById.get(priorAiPlace.id) ?? new Set<string>();
          if (shouldRejectAiPlaceDuplicate(
            otherDatePlaceIds.has(priorAiPlace.id),
            scheduledDates.size > 0,
            additionalRequests,
          )) {
            rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: 'duplicate_ai_place' });
            continue;
          }
          if (scheduledDates.has(recommendation.suggestedDate)) {
            rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: 'duplicate_ai_place_same_day' });
            continue;
          }
          const optionalCategory = optionalStopCategory(candidate);
          if (isOptionalStopAlreadyUsed(optionalStopUsage, recommendation.suggestedDate, optionalCategory)
            && !allowsMultipleOptionalStops(additionalRequests, optionalCategory)) {
            rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: `duplicate_${optionalCategory}` });
            continue;
          }
          scheduledDates.add(recommendation.suggestedDate);
          placedDatesById.set(priorAiPlace.id, scheduledDates);
          markOptionalStop(optionalStopUsage, recommendation.suggestedDate, optionalCategory);
          placements.push(toRecommendedPlacement(priorAiPlace.id, recommendation));
          continue;
        }
        if (knownGoogleIds.has(candidate.googlePlaceId) || knownNames.has(normalizedCandidateName)) {
          this.logger.warn(`AI recommendation rejected reason=duplicate_saved_place name=${recommendation.placeName}`);
          rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: 'duplicate_saved_place' });
          continue;
        }
        const optionalCategory = optionalStopCategory(candidate);
        if (isOptionalStopAlreadyUsed(optionalStopUsage, recommendation.suggestedDate, optionalCategory)
          && !allowsMultipleOptionalStops(additionalRequests, optionalCategory)) {
          rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: `duplicate_${optionalCategory}` });
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
        newlyCreatedByGoogleId.set(candidate.googlePlaceId, entity);
        placedDatesById.set(entity.id, new Set([recommendation.suggestedDate]));
        markOptionalStop(optionalStopUsage, recommendation.suggestedDate, optionalCategory);
        placements.push(toRecommendedPlacement(entity.id, recommendation));
      } catch {
        this.logger.warn(`AI recommended place could not be verified name=${recommendation.placeName}`);
        rejected.push({ placeName: recommendation.placeName, suggestedDate: recommendation.suggestedDate, reason: 'verification_failed' });
      }
    }
    return { placements, created, rejected };
  }

  private async materializeSavedRecommendations(
    tripId: string,
    destination: string,
    selectedRegions: Array<{ name: string; latitude?: number | null; longitude?: number | null }>,
    recommendations: NonNullable<AiPlannerOutput['savedRecommendations']>,
    existingPlaces: SavedPlaceEntity[],
    additionalRequests: string,
  ): Promise<{ created: SavedPlaceEntity[]; rejected: Array<{ placeName: string; reason: string }> }> {
    const knownGoogleIds = new Set(existingPlaces.flatMap((place) => place.googlePlaceId ? [place.googlePlaceId] : []));
    const knownNames = new Set(existingPlaces.map((place) => place.name.trim().toLocaleLowerCase()));
    const created: SavedPlaceEntity[] = [];
    const rejected: Array<{ placeName: string; reason: string }> = [];

    for (const recommendation of recommendations) {
      try {
        const candidates = await this.placeSearch.search(
          recommendation.placeName,
          `${recommendation.regionName}, ${destination}`,
        );
        const candidate = candidates.find((item) =>
          isWithinSelectedRegions(recommendation.regionName, item, selectedRegions)
          && isRecommendableCandidate(item, destination, additionalRequests),
        );
        if (!candidate) {
          rejected.push({ placeName: recommendation.placeName, reason: 'not_found_or_outside_region' });
          continue;
        }
        const normalizedName = candidate.name.trim().toLocaleLowerCase();
        if (knownGoogleIds.has(candidate.googlePlaceId) || knownNames.has(normalizedName)) {
          rejected.push({ placeName: recommendation.placeName, reason: 'duplicate_saved_place' });
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
          note: `AI 추천 · 보관함 · ${recommendation.reason}`,
          isPrimaryLodging: false,
        }));
        knownGoogleIds.add(candidate.googlePlaceId);
        knownNames.add(normalizedName);
        created.push(entity);
      } catch {
        rejected.push({ placeName: recommendation.placeName, reason: 'lookup_failed' });
      }
    }
    return { created, rejected };
  }

  private async enrichTravelEstimates(
    placements: PlannedPlacement[],
    places: SavedPlaceEntity[],
    transportModes: AiTransportMode[] = [],
  ): Promise<PlannedPlacement[]> {
    if (!transportModes.includes(AiTransportMode.PublicTransit)) return placements;
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

function buildReferenceItinerary(
  items: Array<{
    savedPlaceId: string;
    date: string | null;
    position: number | null;
    scheduledTime?: string | null;
    boundaryType?: string | null;
  }>,
  placesById: Map<string, SavedPlaceEntity>,
  targetDate: string,
): AiPlannerInput['referenceItinerary'] {
  const visitsByDate = new Map<string, AiPlannerInput['referenceItinerary'][number]['visits']>();
  const sortedItems = [...items].sort((left, right) =>
    (left.date ?? '').localeCompare(right.date ?? '')
    || (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER),
  );

  for (const item of sortedItems) {
    if (!item.date || item.date === targetDate || item.position === null || item.boundaryType) continue;
    const place = placesById.get(item.savedPlaceId);
    if (!place) continue;
    const visits = visitsByDate.get(item.date) ?? [];
    visits.push({
      placeName: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      tag: place.tag,
      scheduledTime: item.scheduledTime?.slice(0, 5) ?? null,
    });
    visitsByDate.set(item.date, visits);
  }

  return [...visitsByDate].map(([date, visits]) => ({ date, visits }));
}

export type OptionalStopCategory = 'cafe' | 'dessert' | 'tea';

export function optionalStopCategory(
  place: { name: string; primaryType?: string | null; tag?: string | null },
): OptionalStopCategory | null {
  const type = place.primaryType?.toLocaleLowerCase() ?? '';
  const name = place.name.toLocaleLowerCase();
  if (/(?:tea_house|tea_room)/u.test(type) || /(?:티룸|티하우스|차 전문|tea room|tea house)/u.test(name)) return 'tea';
  if (/(?:bakery|dessert|ice_cream|confectionery|chocolate|donut)/u.test(type)
    || /(?:디저트|베이커리|아이스크림|초콜릿|도넛|파티세리|케이크)/u.test(name)) return 'dessert';
  if (/(?:cafe|coffee)/u.test(type) || place.tag === PlaceTag.Cafe
    || /(?:카페|커피|coffee|珈琲)/u.test(name)) return 'cafe';
  return null;
}

export function hasExplicitRepeatRequest(additionalRequests: string): boolean {
  return /(?:재방문|다시\s*방문|두\s*번|2\s*번|여러\s*번|반복|중복|매일|모든\s*날|각\s*날짜|에도\s*(?:가|방문|넣))/u
    .test(additionalRequests.toLocaleLowerCase());
}

const REQUIRED_ACTIVITY_MARKER = /(투어|체험|공연|콘서트|뮤지컬|축제|페스티벌|클래스|강습|크루즈|유람선|트레킹|하이킹)/u;
const NEGATED_ACTIVITY_REQUEST = /(싫|제외|피하|않|말아|금지|빼|취소)/u;

/** Extract only named, schedulable experiences from free-form requests. General tastes remain soft context. */
export function extractRequiredActivityRequests(
  additionalRequests: string,
): AiPlannerInput['travelerContext']['requiredActivityRequests'] {
  const requests = additionalRequests
    .split(/[\n.!?。;,]+/u)
    .map((sourceText) => ({
      sourceText: sourceText.trim(),
      fullDay: /^하루(?:는|동안)?\s*/u.test(sourceText.trim()),
      value: sourceText
        .replace(/^(?:추가\s*요청(?:사항)?|좋아하는\s*것|원하는\s*것)\s*:\s*/u, '')
        .replace(/^하루(?:는|동안)?\s*/u, '')
        .trim(),
    }))
    .filter(({ value }) => REQUIRED_ACTIVITY_MARKER.test(value) && !NEGATED_ACTIVITY_REQUEST.test(value))
    .map(({ value, sourceText, fullDay }) => ({
      sourceText,
      fullDay,
      name: value
        .replace(/\s*(?:은|는|을|를)?\s*(?:할\s*거(?:야|예요|에요|라고.*)?|하려고.*|하고\s*싶.*|하고자.*|(?:할\s*)?예정(?:이에요|예요|입니다)?|예약했.*|신청했.*)$/u, '')
        .trim(),
      minimumStops: fullDay && /투어/u.test(value) ? 2 : 1,
    }))
    .filter(({ name }) => name.length > 1);
  return [...new Map(requests.map((request) => [request.name, request])).values()];
}

export function assessExplicitRequestCoverage(
  requiredActivityRequests: AiPlannerInput['travelerContext']['requiredActivityRequests'],
  output: AiPlannerOutput,
  placeNamesById: Map<string, string> = new Map(),
  lockedPlaceIds: Set<string> = new Set(),
): string[] {
  if (requiredActivityRequests.length === 0) return [];
  return requiredActivityRequests.flatMap((request, index) => {
    const normalizedRequest = normalizeRequestEvidence(request.name);
    const tokens = activityRequestTokens(request.name);
    const matchingVisits = [
      ...output.placements.map((item) => ({ text: `${placeNamesById.get(item.savedPlaceId) ?? ''} ${item.activity ?? ''}`, duration: (item.durationMinutes ?? 0) + (item.travelDurationMinutes ?? 0) })),
      ...output.recommendations.map((item) => ({ text: `${item.placeName} ${item.activity} ${item.reason}`, duration: item.durationMinutes + item.travelDurationMinutes })),
    ].filter(({ text }) => {
      const normalized = normalizeRequestEvidence(text);
      return normalized.includes(normalizedRequest) || (tokens.length > 0 && tokens.every((token) => normalized.includes(token)));
    });
    const lockedCovered = [...lockedPlaceIds].some((id) => normalizeRequestEvidence(placeNamesById.get(id) ?? '').includes(normalizedRequest));
    if (matchingVisits.length === 0 && !lockedCovered) return [`required_activity_missing:${index}`];
    if (matchingVisits.length < request.minimumStops && !lockedCovered) return [`required_activity_stops_missing:${index}`];
    if (request.fullDay && matchingVisits.reduce((total, visit) => total + visit.duration, 0) < 420) {
      return [`required_activity_duration_short:${index}`];
    }
    return [];
  });
}

function activityRequestTokens(request: string): string[] {
  return request
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.replace(/(?:은|는|을|를|이|가|에서|으로|로|와|과|도|만)$/u, ''))
    .filter((token) => token.length >= 2);
}

function normalizeRequestEvidence(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function formatExplicitRequestRevisionGuidance(
  requiredRequests: AiPlannerInput['travelerContext']['requiredActivityRequests'],
  issues: string[],
): string {
  const missing = issues.flatMap((issue) => {
    const match = /^required_activity_(?:missing|stops_missing|duration_short):(\d+)$/u.exec(issue);
    if (!match) return [];
    const request = requiredRequests[Number(match[1])];
    return request ? [request] : [];
  });
  return missing.length > 0
    ? `These explicit traveler activities are mandatory and incomplete: ${missing.map((item) => `"${item.name}" (${item.sourceText})`).join(', ')}. Expand named tour shorthand into at least minimumStops concrete places, label every related activity with the exact request name, keep fullDay requests at least 420 minutes including travel, and return the complete itinerary.`
    : '';
}

export function shouldRejectAiPlaceDuplicate(
  scheduledOnOtherDate: boolean,
  alreadyRecommendedInResponse: boolean,
  additionalRequests: string,
): boolean {
  return (scheduledOnOtherDate || alreadyRecommendedInResponse)
    && !hasExplicitRepeatRequest(additionalRequests);
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

export function allowsMultipleOptionalStops(
  additionalRequests: string,
  category: OptionalStopCategory | null,
): boolean {
  if (!category) return false;
  const aliases: Record<OptionalStopCategory, RegExp> = {
    cafe: /(?:카페|커피|coffee)/u,
    dessert: /(?:디저트|베이커리|아이스크림|케이크|dessert|bakery)/u,
    tea: /(?:차\s*전문|티룸|티하우스|tea)/u,
  };
  const multipleIntent = /(?:투어|여러|다양|두\s*곳|2\s*곳|많이|위주|매일|마다)/u;
  return aliases[category].test(additionalRequests.toLocaleLowerCase())
    && multipleIntent.test(additionalRequests.toLocaleLowerCase());
}

function buildOptionalStopUsage(
  placements: Array<{ savedPlaceId: string; date: string }>,
  placesById: Map<string, SavedPlaceEntity>,
  validDates: Set<string>,
): Map<string, Set<OptionalStopCategory>> {
  const usage = new Map<string, Set<OptionalStopCategory>>();
  for (const placement of placements) {
    if (!validDates.has(placement.date)) continue;
    const place = placesById.get(placement.savedPlaceId);
    const category = place ? optionalStopCategory(place) : null;
    markOptionalStop(usage, placement.date, category);
  }
  return usage;
}

function isOptionalStopAlreadyUsed(
  usage: Map<string, Set<OptionalStopCategory>>,
  date: string,
  category: OptionalStopCategory | null,
): boolean {
  return category !== null && (usage.get(date)?.has(category) ?? false);
}

function markOptionalStop(
  usage: Map<string, Set<OptionalStopCategory>>,
  date: string,
  category: OptionalStopCategory | null,
): void {
  if (!category) return;
  const categories = usage.get(date) ?? new Set<OptionalStopCategory>();
  categories.add(category);
  usage.set(date, categories);
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
    preferredTimeSlot: recommendation.preferredTimeSlot,
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
  destination = '',
  additionalRequests = '',
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
  if (isUnrequestedForeignHospitality(candidate, destination, additionalRequests)) return false;
  return !/(?:역|공항)$/u.test(candidate.name.trim());
}

const COUNTRY_THEME_ALIASES = [
  ['대한민국', '한국', 'korea', '韓国', 'コリア'],
  ['일본', 'japan', '日本'],
  ['중국', 'china', '中国', '中華'],
  ['미국', 'usa', 'america', 'american', 'アメリカ'],
  ['프랑스', 'france', 'french', 'フランス'],
  ['이탈리아', 'italy', 'italian', 'イタリア'],
  ['태국', 'thailand', 'thai', 'タイ'],
  ['베트남', 'vietnam', 'vietnamese', 'ベトナム'],
] as const;

function isUnrequestedForeignHospitality(
  candidate: Pick<PlaceSearchCandidate, 'name' | 'primaryType'>,
  destination: string,
  additionalRequests: string,
): boolean {
  const type = candidate.primaryType?.toLocaleLowerCase() ?? '';
  if (!['bar', 'night_club', 'restaurant', 'cafe', 'coffee', 'food'].some((value) => type.includes(value))) return false;
  const normalizedDestination = destination.toLocaleLowerCase();
  const destinationAliases = COUNTRY_THEME_ALIASES.find((aliases) =>
    aliases.some((alias) => normalizedDestination.includes(alias.toLocaleLowerCase())),
  );
  if (!destinationAliases) return false;
  const normalizedName = candidate.name.toLocaleLowerCase();
  const normalizedRequests = additionalRequests.toLocaleLowerCase();
  return COUNTRY_THEME_ALIASES.some((aliases) =>
    aliases !== destinationAliases
    && aliases.some((alias) => normalizedName.includes(alias.toLocaleLowerCase()))
    && !aliases.some((alias) => normalizedRequests.includes(alias.toLocaleLowerCase())),
  );
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
    if (placement.preferredTimeSlot !== undefined) normalized.preferredTimeSlot = placement.preferredTimeSlot;
    return [normalized];
  });
}

function applyEnrichedTravelEstimates(
  placements: PlannedPlacement[],
  enriched: PlannedPlacement[],
): PlannedPlacement[] {
  const enrichedByVisit = new Map(enriched.map((item) => [`${item.date}:${item.savedPlaceId}`, item]));
  return placements.map((placement) => {
    const match = enrichedByVisit.get(`${placement.date}:${placement.savedPlaceId}`);
    if (!match) return placement;
    return {
      ...placement,
      travelMethod: match.travelMethod,
      travelDurationMinutes: match.travelDurationMinutes,
    };
  });
}

export function normalizeVisitSchedule(
  placements: PlannedPlacement[],
  days: AiPlannerDay[],
  requiredPlaceIds: Set<string> = new Set(),
): PlannedPlacement[] {
  const normalized = placements.map((placement) => ({ ...placement }));
  for (const day of days) {
    const visits = normalized
      .filter((item) => item.date === day.date)
      .sort((left, right) => left.position - right.position);
    if (visits.length === 0) continue;
    const availableStart = (day.availableStartTime ? timeToMinutes(day.availableStartTime) : DEFAULT_DAY_START_MINUTES)
      + (day.hasStartBoundary ? BOUNDARY_TRANSITION_BUFFER_MINUTES : 0);
    const availableEnd = (day.availableEndTime ? timeToMinutes(day.availableEndTime) : DEFAULT_DAY_END_MINUTES)
      - (day.hasEndBoundary ? BOUNDARY_TRANSITION_BUFFER_MINUTES : 0);

    while (visits.length > 0) {
      const scheduled = scheduleVisitsWithoutCompression(visits, availableStart);
      const finalEnd = scheduled.at(-1)?.end ?? availableStart;
      if (finalEnd <= availableEnd) {
        for (const { visit, start } of scheduled) visit.scheduledTime = minutesToTime(start);
        break;
      }
      const removable = visits
        .map((visit, index) => ({ visit, index }))
        .filter(({ visit }) => !requiredPlaceIds.has(visit.savedPlaceId) && !visit.fixedSchedule)
        .sort((left, right) => (right.visit.durationMinutes ?? 15) - (left.visit.durationMinutes ?? 15))[0];
      if (!removable) {
        for (const { visit, start } of scheduled) visit.scheduledTime = minutesToTime(start);
        break;
      }
      const [removed] = visits.splice(removable.index, 1);
      const normalizedIndex = normalized.indexOf(removed!);
      if (normalizedIndex >= 0) normalized.splice(normalizedIndex, 1);
      visits.forEach((visit, index) => { visit.position = index; });
    }
  }
  return normalized;
}

function scheduleVisitsWithoutCompression(visits: PlannedPlacement[], availableStart: number) {
  let cursor = availableStart;
  return visits.map((visit) => {
    const travel = visit.travelDurationMinutes ?? 0;
    const requested = visit.scheduledTime ? timeToMinutes(visit.scheduledTime) : availableStart;
    const preferred = timeSlotWindow(visit.preferredTimeSlot ?? 'any').start;
    const start = Math.max(cursor + travel, requested, preferred ?? availableStart);
    const end = start + (visit.durationMinutes ?? 15);
    cursor = end;
    return { visit, start, end };
  });
}

export function applyVisitTimePreferences(
  placements: PlannedPlacement[],
  placesById: Map<string, Pick<SavedPlaceEntity, 'name' | 'tag'>>,
  requiredRequests: AiPlannerInput['travelerContext']['requiredActivityRequests'],
): PlannedPlacement[] {
  return placements.map((placement) => {
    const place = placesById.get(placement.savedPlaceId);
    const inferred = inferPreferredTimeSlot(place?.name ?? '', placement.activitySummary ?? '', place?.tag ?? null);
    const preferredTimeSlot = inferred === 'any' ? placement.preferredTimeSlot ?? 'any' : inferred;
    const fixedSchedule = requiredRequests.some((request) =>
      normalizeRequestEvidence(placement.activitySummary ?? '').includes(normalizeRequestEvidence(request.name)),
    );
    const preferredWindow = timeSlotWindow(preferredTimeSlot);
    const scheduledMinutes = placement.scheduledTime ? timeToMinutes(placement.scheduledTime) : undefined;
    const scheduledOutsidePreferredWindow = scheduledMinutes !== undefined && (
      (preferredWindow.start !== undefined && scheduledMinutes < preferredWindow.start)
      || (preferredWindow.end !== undefined && scheduledMinutes > preferredWindow.end)
    );
    return {
      ...placement,
      preferredTimeSlot,
      fixedSchedule,
      ...(scheduledOutsidePreferredWindow && preferredWindow.start !== undefined
        ? { scheduledTime: minutesToTime(preferredWindow.start) }
        : {}),
    };
  });
}

/** Move a visit into a verified opening interval when that can be done without violating its preferred slot. */
export function applyOpeningHoursPreferences(
  placements: PlannedPlacement[],
  schedulingDetailsByPlaceId: Map<string, PlaceSchedulingDetails | null>,
): PlannedPlacement[] {
  return placements.map((placement) => {
    const periods = schedulingDetailsByPlaceId.get(placement.savedPlaceId)?.regularOpeningHours?.periods;
    if (!placement.scheduledTime || !periods || periods.length === 0) return placement;
    const duration = placement.durationMinutes ?? 15;
    if (isWithinOpeningHours(placement.date, placement.scheduledTime, duration, periods)) return placement;
    const day = new Date(`${placement.date}T00:00:00.000Z`).getUTCDay();
    const dayStart = day * 24 * 60;
    const preferred = timeSlotWindow(placement.preferredTimeSlot ?? 'any');
    const current = timeToMinutes(placement.scheduledTime);
    const candidates = periods.flatMap((period) => {
      let open = period.open.day * 24 * 60 + period.open.hour * 60 + period.open.minute;
      let close = period.close
        ? period.close.day * 24 * 60 + period.close.hour * 60 + period.close.minute
        : open + 24 * 60;
      if (close <= open) close += 7 * 24 * 60;
      return [-7 * 24 * 60, 0, 7 * 24 * 60].flatMap((weekOffset) => {
        open += weekOffset;
        close += weekOffset;
        const earliest = Math.max(0, open - dayStart, preferred.start ?? 0);
        const latest = Math.min(24 * 60 - duration, close - dayStart - duration, preferred.end ?? 24 * 60 - duration);
        open -= weekOffset;
        close -= weekOffset;
        if (earliest > latest) return [];
        return [Math.min(Math.max(current, earliest), latest)];
      });
    });
    if (candidates.length === 0) return placement;
    const closest = candidates.sort((left, right) => Math.abs(left - current) - Math.abs(right - current))[0]!;
    return { ...placement, scheduledTime: minutesToTime(closest) };
  });
}

export function inferPreferredTimeSlot(name: string, activity: string, tag: string | null): AiVisitTimeSlot {
  const value = `${name} ${activity}`.toLocaleLowerCase();
  if (/(?:아침|조식|브런치|breakfast)/u.test(value)) return 'morning';
  if (/(?:점심|중식|lunch)/u.test(value)) return 'lunch';
  if (/(?:야시장|야경|전망대|관람차|루프탑|night\s*(?:market|view))/u.test(value)) return 'evening';
  if (/(?:일몰|노을|선셋|sunset)/u.test(value)) return 'sunset';
  if (/(?:저녁|석식|dinner)/u.test(value)) return 'evening';
  if (tag === PlaceTag.Cafe && /모닝/u.test(value)) return 'morning';
  return 'any';
}

export function assessTimeSuitability(placements: PlannedPlacement[]): string[] {
  return placements.flatMap((placement) => {
    if (!placement.scheduledTime || !placement.preferredTimeSlot || placement.preferredTimeSlot === 'any') return [];
    const start = timeToMinutes(placement.scheduledTime);
    const window = timeSlotWindow(placement.preferredTimeSlot);
    return (window.start !== undefined && start < window.start)
      || (window.end !== undefined && start > window.end)
      ? [`time_slot_mismatch:${placement.date}:${placement.savedPlaceId}`]
      : [];
  });
}

export function assessOpeningHours(
  placements: PlannedPlacement[],
  schedulingDetailsByPlaceId: Map<string, PlaceSchedulingDetails | null>,
): string[] {
  return placements.flatMap((placement) => {
    const periods = schedulingDetailsByPlaceId.get(placement.savedPlaceId)?.regularOpeningHours?.periods;
    if (!placement.scheduledTime || !periods || periods.length === 0) return [];
    const open = isWithinOpeningHours(
      placement.date,
      placement.scheduledTime,
      placement.durationMinutes ?? 15,
      periods,
    );
    return open ? [] : [`closed_place:${placement.date}:${placement.savedPlaceId}`];
  });
}

function isWithinOpeningHours(date: string, time: string, durationMinutes: number, periods: PlaceOpeningPeriod[]): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const start = day * 24 * 60 + timeToMinutes(time);
  const end = start + durationMinutes;
  return periods.some((period) => {
    const open = period.open.day * 24 * 60 + period.open.hour * 60 + period.open.minute;
    if (!period.close) return start >= open;
    let close = period.close.day * 24 * 60 + period.close.hour * 60 + period.close.minute;
    if (close <= open) close += 7 * 24 * 60;
    const adjustedStart = start < open && day === 0 ? start + 7 * 24 * 60 : start;
    return adjustedStart >= open && end + (adjustedStart - start) <= close;
  });
}

function timeSlotWindow(slot: AiVisitTimeSlot): { start?: number; end?: number } {
  switch (slot) {
    case 'morning': return { start: 7 * 60, end: 10 * 60 + 59 };
    case 'lunch': return { start: 11 * 60, end: 14 * 60 + 30 };
    case 'daytime': return { start: 9 * 60, end: 17 * 60 };
    case 'sunset': return { start: 16 * 60, end: 19 * 60 };
    case 'evening': return { start: 17 * 60, end: 21 * 60 };
    case 'night': return { start: 19 * 60, end: 23 * 60 + 59 };
    case 'any':
    default: return {};
  }
}

type QualityAssessmentInput = {
  days: AiPlannerDay[];
  density: TravelDensity;
  planningPlaces: SavedPlaceEntity[];
  generated: PlannedPlacement[];
  recommended: PlannedPlacement[];
  locked: Array<{ savedPlaceId: string; date: string | null; position: number | null; scheduledTime?: string | null }>;
  placeTagsById: Map<string, string>;
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
    const visitCount = timedVisits.length + lockedVisitCount;
    if (
      visitCount < minimumRequiredVisitCount(day, input.density)
      || plannedMinutes < minimumAcceptablePlannedMinutes(day, input.density)
    ) issues.push(`underfilled_day:${day.date}`);

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
      const start = timeToMinutes(visit.scheduledTime);
      const end = start + visit.durationMinutes;
      if (day.availableStartTime && start - visit.travelDurationMinutes < timeToMinutes(day.availableStartTime)) {
        issues.push(`outside_available_window:${day.date}`);
      }
      if (day.availableEndTime && end > timeToMinutes(day.availableEndTime)) {
        issues.push(`outside_available_window:${day.date}`);
      }
      if (previousEnd !== undefined && start < previousEnd + visit.travelDurationMinutes) {
        issues.push(`invalid_time_window:${day.date}`);
      }
      previousEnd = end;
    }
  }
  issues.push(...assessMissingMeals(input.days, allPlacements, input.locked, input.placeTagsById));
  return [...new Set(issues)];
}

export function isBlockingQualityIssue(issue: string): boolean {
  return issue.length > 0
    && ![
      'missing_meal:',
      'underfilled_day:',
      'time_slot_mismatch:',
      'closed_place:',
    ].some((prefix) => issue.startsWith(prefix));
}

function toRevisionDraft(output: AiPlannerOutput): Omit<AiPlannerOutput, 'usage'> {
  return {
    placements: output.placements,
    unplaced: output.unplaced,
    placeDescriptions: output.placeDescriptions ?? [],
    recommendations: output.recommendations,
    savedRecommendations: output.savedRecommendations ?? [],
  };
}

function toMaterializedReviewDraft(
  generated: PlannedPlacement[],
  recommended: PlannedPlacement[],
  placesById: Map<string, SavedPlaceEntity>,
  source: AiPlannerOutput,
): Omit<AiPlannerOutput, 'usage'> {
  return {
    placements: generated.map((placement) => ({
      savedPlaceId: placement.savedPlaceId,
      date: placement.date,
      position: placement.position,
      startTime: placement.scheduledTime ?? '09:00',
      durationMinutes: placement.durationMinutes ?? 60,
      activity: placement.activitySummary ?? `${placesById.get(placement.savedPlaceId)?.name ?? '장소'} 방문`,
      travelMethod: placement.travelMethod ?? '대중교통',
      travelDurationMinutes: placement.travelDurationMinutes ?? 0,
      preferredTimeSlot: placement.preferredTimeSlot ?? 'any',
    })),
    unplaced: source.unplaced,
    placeDescriptions: source.placeDescriptions ?? [],
    recommendations: recommended.map((placement) => {
      const place = placesById.get(placement.savedPlaceId);
      return {
        placeName: place?.name ?? '추천 장소',
        regionName: place?.address ?? '여행 지역',
        suggestedDate: placement.date,
        position: placement.position,
        startTime: placement.scheduledTime ?? '09:00',
        durationMinutes: placement.durationMinutes ?? 60,
        activity: placement.activitySummary ?? `${place?.name ?? '추천 장소'} 방문`,
        travelMethod: placement.travelMethod ?? '대중교통',
        travelDurationMinutes: placement.travelDurationMinutes ?? 0,
        reason: place?.note?.replace(/^AI 추천\s*·\s*/u, '') || '동선과 여행 목적에 맞는 검증된 장소',
        preferredTimeSlot: placement.preferredTimeSlot ?? 'any',
      };
    }),
    savedRecommendations: source.savedRecommendations ?? [],
  };
}

function sanitizePlaceDescription(description: string): string {
  const normalized = description.trim().replace(/\s+/gu, ' ').slice(0, 300);
  if (/(?:보관함|저장한 장소|저장합니다|일정 보완|일정상|이번 일정|일정에서 제외|일정에는 제외|동선상|시간상|공간 부족|장소 교체 필요)/u.test(normalized)) return '';
  return normalized;
}

function isRepairableQualityIssue(issue: string): boolean {
  if (issue === 'saved_places_missing' || issue === 'saved_places_unplaced' || issue === 'must_visit_missing') return true;
  return [
    'underfilled_day:',
    'schedule_detail_missing:',
    'invalid_time_window:',
    'outside_available_window:',
    'required_activity_missing:',
    'required_activity_stops_missing:',
    'required_activity_duration_short:',
    'time_slot_mismatch:',
    'closed_place:',
  ].some((prefix) => issue.startsWith(prefix));
}

type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export function requiredMealSlots(day: AiPlannerDay, dayIndex: number, dayCount: number): MealSlot[] {
  const start = timeToMinutes(day.availableStartTime ?? '09:00');
  const end = timeToMinutes(day.availableEndTime ?? '21:00');
  const isFirstDay = day.isFirstDay ?? dayIndex === 0;
  const isLastDay = day.isLastDay ?? dayIndex === dayCount - 1;
  return [
    ...(!isFirstDay && start <= 10 * 60 + 30 && end >= 7 * 60 ? ['breakfast' as const] : []),
    ...(start <= 14 * 60 && end >= 12 * 60 ? ['lunch' as const] : []),
    ...(!isLastDay && start <= 20 * 60 && end >= 17 * 60 ? ['dinner' as const] : []),
  ];
}

function mealSlot(time: string): MealSlot | null {
  const minutes = timeToMinutes(time);
  if (minutes >= 7 * 60 && minutes < 11 * 60) return 'breakfast';
  if (minutes >= 11 * 60 && minutes < 15 * 60) return 'lunch';
  if (minutes >= 17 * 60 && minutes < 21 * 60) return 'dinner';
  return null;
}

export function assessMissingMeals(
  days: AiPlannerDay[],
  placements: Array<Pick<PlannedPlacement, 'savedPlaceId' | 'date' | 'scheduledTime'>>,
  locked: Array<{ savedPlaceId: string; date: string | null; scheduledTime?: string | null }>,
  placeTagsById: Map<string, string>,
): string[] {
  return days.flatMap((day, dayIndex) => {
    const mealVisits = [
      ...placements
        .filter((item) => item.date === day.date)
        .map((item) => ({ savedPlaceId: item.savedPlaceId, scheduledTime: item.scheduledTime ?? null })),
      ...locked
        .filter((item) => item.date === day.date)
        .map((item) => ({ savedPlaceId: item.savedPlaceId, scheduledTime: item.scheduledTime ?? null })),
    ].filter((visit) => placeTagsById.get(visit.savedPlaceId) === PlaceTag.Food && visit.scheduledTime);
    return requiredMealSlots(day, dayIndex, days.length)
      .filter((meal) => !mealVisits.some((visit) => mealSlot(visit.scheduledTime!) === meal))
      .map((meal) => `missing_meal:${day.date}:${meal}`);
  });
}

function parseMissingMealIssue(issue: string): { date: string; meal: MealSlot } | null {
  const match = /^missing_meal:(\d{4}-\d{2}-\d{2}):(breakfast|lunch|dinner)$/u.exec(issue);
  return match ? { date: match[1]!, meal: match[2] as MealSlot } : null;
}

function mealLabel(meal: MealSlot): string {
  return { breakfast: '아침', lunch: '점심', dinner: '저녁' }[meal];
}

function suggestedMealTime(day: AiPlannerDay, meal: MealSlot): string | null {
  const preferred = { breakfast: 9 * 60, lunch: 12 * 60, dinner: 18 * 60 }[meal];
  const availableStart = timeToMinutes(day.availableStartTime ?? '09:00');
  const availableEnd = timeToMinutes(day.availableEndTime ?? '21:00');
  const start = Math.max(preferred, availableStart);
  return start + 60 <= availableEnd ? minutesToTime(start) : null;
}

function preferredTravelMethod(modes: AiTransportMode[]): string {
  if (modes.includes(AiTransportMode.PublicTransit)) return '대중교통';
  if (modes.includes(AiTransportMode.Walking)) return '도보';
  return '차량 이동';
}

function reindexPlacementsByTime(placements: PlannedPlacement[]): PlannedPlacement[] {
  return [...placements]
    .sort((left, right) => left.date.localeCompare(right.date)
      || effectiveScheduleTime(left).localeCompare(effectiveScheduleTime(right))
      || left.position - right.position)
    .map((placement, index, sorted) => ({
      ...placement,
      position: sorted.slice(0, index).filter((item) => item.date === placement.date).length,
    }));
}

function effectiveScheduleTime(placement: PlannedPlacement): string {
  const preferredStart = timeSlotWindow(placement.preferredTimeSlot ?? 'any').start;
  if (preferredStart === undefined) return placement.scheduledTime ?? '23:59';
  const scheduled = placement.scheduledTime ? timeToMinutes(placement.scheduledTime) : preferredStart;
  return minutesToTime(Math.max(preferredStart, scheduled));
}

export function assessRawDayCoverage(
  days: AiPlannerDay[],
  output: AiPlannerOutput,
  density: TravelDensity,
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
    return visits.length < minimumRequiredVisitCount(day, density)
      || plannedMinutes < minimumAcceptablePlannedMinutes(day, density)
      ? [day.date]
      : [];
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

function minimumPlannedMinutes(density: TravelDensity): number {
  switch (density) {
    case TravelDensity.Relaxed: return 420;
    case TravelDensity.Busy: return 480;
    case TravelDensity.Balanced:
    default: return 450;
  }
}

function targetPlannedMinutes(day: AiPlannerDay, density: TravelDensity): number {
  return day.targetPlannedMinutes ?? minimumPlannedMinutes(density);
}

function minimumRequiredVisitCount(day: AiPlannerDay, density: TravelDensity): number {
  const target = targetPlannedMinutes(day, density);
  if (target <= 0) return 0;
  if (target < 240) return 1;
  if (target < 360) return 2;
  return density === TravelDensity.Relaxed ? 2 : 3;
}

function minimumAcceptablePlannedMinutes(day: AiPlannerDay, density: TravelDensity): number {
  return targetPlannedMinutes(day, density);
}

function formatCoverageTargets(days: AiPlannerDay[], dates: string[], density: TravelDensity): string {
  const includedDates = new Set(dates);
  return days
    .filter((day) => includedDates.has(day.date))
    .map((day) => `${day.date}=${targetPlannedMinutes(day, density)} minutes`)
    .join(', ');
}

export function applyDailyPlanningTargets(
  days: AiPlannerDay[],
  density: TravelDensity,
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
    const partialDayTarget = Math.floor(
      (realisticVisitMinutes * PARTIAL_DAY_TARGET_UTILIZATION) / 15,
    ) * 15;
    return {
      ...day,
      availableStartTime: minutesToTime(availableStart),
      availableEndTime: minutesToTime(availableEnd),
      targetPlannedMinutes: Math.min(minimumPlannedMinutes(density), partialDayTarget),
      hasStartBoundary: index === 0 && Boolean(startPointTime),
      hasEndBoundary: index === lastIndex && Boolean(endPointTime),
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

function normalizeLatestAiPlanRequest(input: TripAiPlanRequest | null): GenerateAiPlanDto | null {
  if (!input) return null;
  const densityValues = new Set(Object.values(TravelDensity));
  const themeValues = new Set(Object.values(TravelTheme));
  const transportValues = new Set(Object.values(AiTransportMode));
  const budgetValues = new Set(Object.values(AiBudgetLevel));
  const legacyDensity = input.style === 'relaxed'
    ? TravelDensity.Relaxed
    : input.style === 'highlights' ? TravelDensity.Busy : TravelDensity.Balanced;
  const density = densityValues.has(input.density as TravelDensity)
    ? input.density as TravelDensity
    : legacyDensity;
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
    density,
    themes,
    transportModes,
    ...(input.companions ? { companions: input.companions } : {}),
    ...(budgetValues.has(input.budgetLevel as AiBudgetLevel) ? { budgetLevel: input.budgetLevel as AiBudgetLevel } : {}),
    ...((input.additionalRequests || legacyRequests) ? { additionalRequests: input.additionalRequests || legacyRequests } : {}),
  };
}

function defaultAiPlanRequest(): GenerateAiPlanDto {
  return {
    density: TravelDensity.Balanced,
    themes: [TravelTheme.Highlights],
    transportModes: [AiTransportMode.PublicTransit],
    budgetLevel: AiBudgetLevel.Standard,
  };
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(values[index]!);
    }
  }));
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

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60).toString().padStart(2, '0');
  const minutes = (value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
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
