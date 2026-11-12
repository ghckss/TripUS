import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { ItineraryItemEntity, ItinerarySource } from '../domain/entities/itinerary-item.entity';
import { ItineraryBoundaryType, ItineraryResponseDto, ItineraryUpdateResultDto, ItineraryUpdateStatus, ReplaceItineraryItemDto } from './dto/itinerary.dto';

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
    const trip = await this.assertOwnedActiveTrip(tripId);
    return this.read(trip);
  }

  async replace(tripId: string, input: ReplaceItineraryItemDto[], source = ItinerarySource.Manual): Promise<ItineraryUpdateResultDto> {
    const trip = await this.assertOwnedActiveTrip(tripId);
    const conflicts = await this.findConflicts(trip, input);
    if (conflicts.length > 0) {
      return { status: ItineraryUpdateStatus.Conflict, conflicts, itinerary: await this.read(trip) };
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ItineraryItemEntity, { tripId });
      if (input.length > 0) {
        await manager.save(ItineraryItemEntity, input.map((item) => manager.create(ItineraryItemEntity, {
          tripId,
          savedPlaceId: item.savedPlaceId,
          date: item.date,
          position: item.position,
          scheduledTime: item.scheduledTime ?? null,
          durationMinutes: item.durationMinutes ?? null,
          activitySummary: item.activitySummary ?? null,
          travelMethod: item.travelMethod ?? null,
          travelDurationMinutes: item.travelDurationMinutes ?? null,
          locked: item.locked ?? false,
          source,
          visitStatus: null,
          rating: null,
          review: null,
        })));
      }
    });

    return { status: ItineraryUpdateStatus.Updated, conflicts: [], itinerary: await this.read(trip) };
  }

  private async read(trip: TripEntity): Promise<ItineraryResponseDto> {
    const tripId = trip.id;
    const [items, places] = await Promise.all([
      this.items.find({ where: { tripId }, relations: { savedPlace: true }, order: { date: 'ASC', position: 'ASC' } }),
      this.places.find({ where: { tripId, isPrimaryLodging: false }, order: { createdAt: 'ASC' } }),
    ]);
    const placedIds = new Set(items.map((item) => item.savedPlaceId));
    return {
      items: addTripBoundaryPoints(items.map(ItineraryResponseDtoItem), trip),
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
    if (ids.length > 0) {
      const owned = await this.places.countBy({ id: In(ids), tripId: trip.id });
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
    latitude: entity.savedPlace.latitude,
    longitude: entity.savedPlace.longitude,
    date: entity.date,
    position: entity.position,
    scheduledTime: entity.scheduledTime?.slice(0, 5) ?? null,
    durationMinutes: entity.durationMinutes,
    activitySummary: entity.activitySummary,
    travelMethod: entity.travelMethod,
    travelDurationMinutes: entity.travelDurationMinutes,
    locked: entity.locked,
    source: entity.source,
    visitStatus: entity.visitStatus,
    rating: entity.rating,
    review: entity.review,
    boundaryType: null,
  };
}

export function addTripBoundaryPoints(
  items: ItineraryResponseDto['items'],
  trip: Pick<TripEntity, 'id' | 'startDate' | 'endDate' | 'startPoint' | 'endPoint'>,
): ItineraryResponseDto['items'] {
  const withoutVirtualBoundaries = items.filter((item) => !item.boundaryType);
  const byDate = new Map<string, ItineraryResponseDto['items']>();
  for (const item of withoutVirtualBoundaries) {
    if (!item.date) continue;
    const dateItems = byDate.get(item.date) ?? [];
    dateItems.push(item);
    byDate.set(item.date, dateItems);
  }
  const result = withoutVirtualBoundaries.filter((item) => !item.date);
  for (const date of [...byDate.keys(), trip.startDate, trip.endDate].filter((value, index, values) => values.indexOf(value) === index).sort()) {
    const dateItems = (byDate.get(date) ?? []).sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    const start = date === trip.startDate && trip.startPoint
      ? [boundaryItem(trip, ItineraryBoundaryType.StartPoint, date, trip.startPoint, 0)]
      : [];
    const shifted = dateItems.map((item, index) => ({ ...item, position: index + start.length }));
    const end = date === trip.endDate && trip.endPoint
      ? [boundaryItem(trip, ItineraryBoundaryType.EndPoint, date, trip.endPoint, shifted.length + start.length)]
      : [];
    result.push(...start, ...shifted, ...end);
  }
  return result;
}

function boundaryItem(
  trip: Pick<TripEntity, 'id'>,
  boundaryType: ItineraryBoundaryType,
  date: string,
  point: NonNullable<TripEntity['startPoint']>,
  position: number,
): ItineraryResponseDto['items'][number] {
  const isStart = boundaryType === ItineraryBoundaryType.StartPoint;
  return {
    id: `boundary:${boundaryType}:${trip.id}`,
    savedPlaceId: trip.id,
    placeName: point.name,
    address: point.address,
    latitude: point.latitude,
    longitude: point.longitude,
    date,
    position,
    scheduledTime: point.time,
    durationMinutes: null,
    activitySummary: isStart ? '여행 시작 지점' : '여행 종료 지점',
    travelMethod: null,
    travelDurationMinutes: null,
    locked: true,
    source: ItinerarySource.Manual,
    visitStatus: null,
    rating: null,
    review: null,
    boundaryType,
  };
}
