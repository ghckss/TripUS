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
  ) {}

  async generate(tripId: string, style: TravelStyle): Promise<GenerateAiPlanResponseDto> {
    this.rateLimiter.assertAllowed(this.identity.getCurrentUserId());
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    const places = await this.places.find({ where: { tripId }, order: { createdAt: 'ASC' } });
    if (places.length === 0) throw new BadRequestException('Save at least one place before generating an itinerary');
    if (places.length > 100) throw new BadRequestException('AI planning supports at most 100 saved places');
    try {
      const output = await this.planner.generate({
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      style,
      places: places.map((place) => ({ id: place.id, name: place.name, tag: place.tag, preference: place.preference, note: place.note })),
      });
      if (output.usage) this.logger.log(`AI itinerary generated inputTokens=${output.usage.inputTokens} outputTokens=${output.usage.outputTokens}`);
      const allowed = new Set(places.map((place) => place.id));
      const placements = output.placements.filter((item) => allowed.has(item.savedPlaceId));
      const result = await this.itineraries.replace(tripId, placements, ItinerarySource.Ai);
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
