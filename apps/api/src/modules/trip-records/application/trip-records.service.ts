import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { ItinerariesService } from '../../itineraries/application/itineraries.service';
import { ItineraryItemEntity } from '../../itineraries/domain/entities/itinerary-item.entity';
import { TripResponseDto } from '../../trips/application/dto/trip-response.dto';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { CompleteTripDto, CompleteTripResponseDto } from './dto/complete-trip.dto';
import { resolveVisitResult } from './visit-result.policy';

@Injectable()
export class TripRecordsService {
  constructor(
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(ItineraryItemEntity) private readonly items: Repository<ItineraryItemEntity>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(ItinerariesService) private readonly itineraries: ItinerariesService,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  async complete(tripId: string, input: CompleteTripDto): Promise<CompleteTripResponseDto> {
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    const items = await this.items.findBy({ tripId });
    const byId = new Map(input.items.map((item) => [item.itineraryItemId, item]));
    if (byId.size !== input.items.length) throw new BadRequestException('Duplicate itinerary item');
    if (input.items.some((item) => !items.some((entity) => entity.id === item.itineraryItemId))) {
      throw new BadRequestException('Itinerary item does not belong to trip');
    }

    const archivedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      for (const item of items) {
        Object.assign(item, resolveVisitResult(byId.get(item.id)));
        await manager.save(ItineraryItemEntity, item);
      }
      trip.archivedAt = archivedAt;
      await manager.save(TripEntity, trip);
    });

    return {
      trip: TripResponseDto.fromEntity(trip),
      itinerary: await this.itineraries.get(tripId),
    };
  }
}
