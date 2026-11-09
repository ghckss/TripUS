import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { ItineraryItemEntity, ItinerarySource } from '../domain/entities/itinerary-item.entity';
import { ItineraryResponseDto, ItineraryUpdateResultDto, ItineraryUpdateStatus, ReplaceItineraryItemDto } from './dto/itinerary.dto';

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectRepository(ItineraryItemEntity) private readonly items: Repository<ItineraryItemEntity>,
    @InjectRepository(SavedPlaceEntity) private readonly places: Repository<SavedPlaceEntity>,
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  async get(tripId: string): Promise<ItineraryResponseDto> {
    await this.assertOwnedActiveTrip(tripId);
    return this.read(tripId);
  }

  async replace(tripId: string, input: ReplaceItineraryItemDto[], source = ItinerarySource.Manual): Promise<ItineraryUpdateResultDto> {
    const trip = await this.assertOwnedActiveTrip(tripId);
    const conflicts = await this.findConflicts(trip, input);
    if (conflicts.length > 0) {
      return { status: ItineraryUpdateStatus.Conflict, conflicts, itinerary: await this.read(tripId) };
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ItineraryItemEntity, { tripId });
      if (input.length > 0) {
        await manager.save(ItineraryItemEntity, input.map((item) => manager.create(ItineraryItemEntity, {
          tripId,
          savedPlaceId: item.savedPlaceId,
          date: item.date,
          position: item.position,
          locked: item.locked ?? false,
          source,
          visitStatus: null,
          rating: null,
          review: null,
        })));
      }
    });

    return { status: ItineraryUpdateStatus.Updated, conflicts: [], itinerary: await this.read(tripId) };
  }

  private async read(tripId: string): Promise<ItineraryResponseDto> {
    const [items, places] = await Promise.all([
      this.items.find({ where: { tripId }, relations: { savedPlace: true }, order: { date: 'ASC', position: 'ASC' } }),
      this.places.find({ where: { tripId, isPrimaryLodging: false }, order: { createdAt: 'ASC' } }),
    ]);
    const placedIds = new Set(items.map((item) => item.savedPlaceId));
    return {
      items: items.map(ItineraryResponseDtoItem),
      unplaced: places
        .filter((place) => !place.isPrimaryLodging && !placedIds.has(place.id))
        .map((place) => ({ savedPlaceId: place.id, placeName: place.name })),
    };
  }

  private async findConflicts(trip: TripEntity, input: ReplaceItineraryItemDto[]): Promise<string[]> {
    const conflicts: string[] = [];
    const slots = new Set<string>();
    for (const item of input) {
      if (item.date < trip.startDate || item.date > trip.endDate) conflicts.push(`DATE_OUT_OF_RANGE:${item.savedPlaceId}`);
      const slot = `${item.date}:${item.position}`;
      if (slots.has(slot)) conflicts.push(`DUPLICATE_SLOT:${slot}`);
      slots.add(slot);
    }
    const ids = [...new Set(input.map((item) => item.savedPlaceId))];
    if (ids.length !== input.length) conflicts.push('DUPLICATE_PLACE');
    if (ids.length > 0) {
      const owned = await this.places.countBy({ id: In(ids), tripId: trip.id, isPrimaryLodging: false });
      if (owned !== ids.length) conflicts.push('PLACE_NOT_IN_TRIP');
    }
    return conflicts;
  }

  private async assertOwnedActiveTrip(tripId: string): Promise<TripEntity> {
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }
}

function ItineraryResponseDtoItem(entity: ItineraryItemEntity) {
  return {
    id: entity.id,
    savedPlaceId: entity.savedPlaceId,
    placeName: entity.savedPlace.name,
    address: entity.savedPlace.address,
    date: entity.date,
    position: entity.position,
    locked: entity.locked,
    source: entity.source,
    visitStatus: entity.visitStatus,
    rating: entity.rating,
    review: entity.review,
  };
}
