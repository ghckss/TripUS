import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { ItinerariesService } from '../../itineraries/application/itineraries.service';
import { ItinerarySource } from '../../itineraries/domain/entities/itinerary-item.entity';
import { SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { AI_PLANNER_PORT, type AiPlannerPort, TravelStyle } from '../domain/ai-planner.port';
import { GenerateAiPlanResponseDto } from './dto/generate-ai-plan.dto';

@Injectable()
export class AiPlanningService {
  constructor(
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(SavedPlaceEntity) private readonly places: Repository<SavedPlaceEntity>,
    @Inject(AI_PLANNER_PORT) private readonly planner: AiPlannerPort,
    @Inject(ItinerariesService) private readonly itineraries: ItinerariesService,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  async generate(tripId: string, style: TravelStyle): Promise<GenerateAiPlanResponseDto> {
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    const places = await this.places.find({ where: { tripId }, order: { createdAt: 'ASC' } });
    const output = await this.planner.generate({
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      style,
      places: places.map((place) => ({ id: place.id, name: place.name, tag: place.tag, preference: place.preference, note: place.note })),
    });
    const allowed = new Set(places.map((place) => place.id));
    const placements = output.placements.filter((item) => allowed.has(item.savedPlaceId));
    const result = await this.itineraries.replace(tripId, placements, ItinerarySource.Ai);
    return { ...result, style };
  }
}
