import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { ItinerariesService } from '../../itineraries/application/itineraries.service';
import { ItinerarySource } from '../../itineraries/domain/entities/itinerary-item.entity';
import { ItineraryUpdateStatus } from '../../itineraries/application/dto/itinerary.dto';
import { SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { AI_PLANNER_PORT, AiPlannerError, type AiPlannerPort, TravelStyle } from '../domain/ai-planner.port';
import { AiPlanGenerationStatus, GenerateAiPlanResponseDto } from './dto/generate-ai-plan.dto';
import { AiPlanningRateLimiter } from './ai-planning-rate-limiter';
import { EntitlementsService } from '../../entitlements/application/entitlements.service';
import { TripDaySettingsService } from '../../trip-day-settings/application/trip-day-settings.service';
import { PlaceTag } from '../../places/domain/entities/saved-place.entity';

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
  ) {}

  async generate(tripId: string, style: TravelStyle): Promise<GenerateAiPlanResponseDto> {
    this.rateLimiter.assertAllowed(this.identity.getCurrentUserId());
    await this.entitlements.assertCanGenerateAiPlan();
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    const places = await this.places.find({ where: { tripId }, order: { createdAt: 'ASC' } });
    const current = await this.itineraries.get(tripId);
    const locked = current.items.filter((item) => item.locked && item.date !== null && item.position !== null);
    const lockedIds = new Set(locked.map((item) => item.savedPlaceId));
    const planningPlaces = places.filter((place) => place.tag !== PlaceTag.Lodging && !lockedIds.has(place.id));
    if (planningPlaces.length === 0) throw new BadRequestException('Save at least one non-lodging place before generating an itinerary');
    if (planningPlaces.length > 100) throw new BadRequestException('AI planning supports at most 100 saved places');
    const settings = await this.daySettings.get(tripId);
    try {
      const output = await this.planner.generate({
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      style,
      places: planningPlaces.map((place) => ({ id: place.id, name: place.name, tag: place.tag, preference: place.preference, note: place.note })),
      daySettings: settings.map(({ date, startTime, endTime, startPlaceName, endPlaceName }) => ({ date, startTime, endTime, startPlaceName, endPlaceName })),
      lockedPlacements: locked.map((item) => ({ savedPlaceId: item.savedPlaceId, date: item.date!, position: item.position! })),
      });
      if (output.usage) this.logger.log(`AI itinerary generated inputTokens=${output.usage.inputTokens} outputTokens=${output.usage.outputTokens}`);
      const allowed = new Set(planningPlaces.map((place) => place.id));
      const generated = output.placements.filter((item) => allowed.has(item.savedPlaceId));
      const placements = mergeLockedPlacements(locked, generated);
      const result = await this.itineraries.replace(tripId, placements, ItinerarySource.Ai);
      await this.entitlements.recordSuccessfulAiGeneration();
      return {
        status: result.status === ItineraryUpdateStatus.Updated ? AiPlanGenerationStatus.Generated : AiPlanGenerationStatus.Conflict,
        style,
        conflicts: result.conflicts,
        itinerary: result.itinerary,
        failureReason: null,
      };
    } catch (error) {
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
}

function mergeLockedPlacements(
  locked: Array<{ savedPlaceId: string; date: string | null; position: number | null }>,
  generated: Array<{ savedPlaceId: string; date: string; position: number }>,
) {
  const dates = new Set([...locked.map((item) => item.date!), ...generated.map((item) => item.date)]);
  return [...dates].flatMap((date) => {
    const fixed = locked.filter((item) => item.date === date).sort((a, b) => a.position! - b.position!);
    const movable = generated.filter((item) => item.date === date).sort((a, b) => a.position - b.position);
    let movableIndex = 0;
    const result: Array<{ savedPlaceId: string; date: string; position: number; locked: boolean }> = [];
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
