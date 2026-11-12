import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { CreateTripDto } from './dto/create-trip.dto';
import { TripResponseDto } from './dto/trip-response.dto';
import { TripEntity } from '../domain/entities/trip.entity';
import { TripListStatus } from './dto/list-trips-query.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { EntitlementsService } from '../../entitlements/application/entitlements.service';
import { TripRegionDto } from './dto/trip-region.dto';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(TripEntity)
    private readonly trips: Repository<TripEntity>,
    @Inject(IDENTITY_PORT)
    private readonly identity: IdentityPort,
    @Inject(EntitlementsService)
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(status: TripListStatus = TripListStatus.Current): Promise<TripResponseDto[]> {
    const entities = await this.trips.find({
      where: {
        ownerId: this.identity.getCurrentUserId(),
        active: true,
        ...(status === TripListStatus.Current ? { archivedAt: IsNull() } : {}),
        ...(status === TripListStatus.Completed ? { archivedAt: Not(IsNull()) } : {}),
      },
      order: { startDate: 'ASC' },
    });
    return entities.map((entity) => TripResponseDto.fromEntity(entity));
  }

  async create(input: CreateTripDto): Promise<TripResponseDto> {
    if (input.endDate < input.startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    await this.entitlements.assertCanCreateTrip();
    const entity = this.trips.create({
      ...input,
      regions: normalizeRegions(input.regions ?? []),
      startPoint: normalizeBoundaryPoint(input.startPoint),
      endPoint: normalizeBoundaryPoint(input.endPoint),
      ownerId: this.identity.getCurrentUserId(),
      active: true,
      archivedAt: null,
    });
    return TripResponseDto.fromEntity(await this.trips.save(entity));
  }

  async get(tripId: string): Promise<TripResponseDto> {
    return TripResponseDto.fromEntity(await this.findOwnedActiveTrip(tripId));
  }

  async update(tripId: string, input: UpdateTripDto): Promise<TripResponseDto> {
    const entity = await this.findOwnedActiveTrip(tripId);
    const startDate = input.startDate ?? entity.startDate;
    const endDate = input.endDate ?? entity.endDate;
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    Object.assign(entity, {
      ...input,
      ...(input.regions ? { regions: normalizeRegions(input.regions) } : {}),
      ...(input.startPoint !== undefined ? { startPoint: normalizeBoundaryPoint(input.startPoint) } : {}),
      ...(input.endPoint !== undefined ? { endPoint: normalizeBoundaryPoint(input.endPoint) } : {}),
    });
    return TripResponseDto.fromEntity(await this.trips.save(entity));
  }

  async remove(tripId: string): Promise<void> {
    const entity = await this.findOwnedActiveTrip(tripId);
    entity.active = false;
    await this.trips.save(entity);
  }

  private async findOwnedActiveTrip(tripId: string): Promise<TripEntity> {
    const entity = await this.trips.findOneBy({
      id: tripId,
      ownerId: this.identity.getCurrentUserId(),
      active: true,
    });
    if (!entity) {
      throw new NotFoundException('Trip not found');
    }
    return entity;
  }
}

function normalizeBoundaryPoint(point: CreateTripDto['startPoint']) {
  if (!point) return null;
  const name = point.name.trim();
  if (!name) throw new BadRequestException('Trip boundary point name must not be empty');
  const hasLatitude = point.latitude !== null && point.latitude !== undefined;
  const hasLongitude = point.longitude !== null && point.longitude !== undefined;
  if (hasLatitude !== hasLongitude) throw new BadRequestException('Trip boundary point coordinates must include both latitude and longitude');
  return {
    googlePlaceId: point.googlePlaceId?.trim() || null,
    name,
    address: point.address?.trim() || null,
    latitude: point.latitude ?? null,
    longitude: point.longitude ?? null,
    time: point.time?.trim() || null,
  };
}

function normalizeRegions(regions: TripRegionDto[]) {
  const seen = new Set<string>();
  return regions.map((region) => {
    const googlePlaceId = region.googlePlaceId?.trim() || null;
    const name = region.name.trim();
    const address = region.address?.trim() || null;
    const hasLatitude = region.latitude !== null && region.latitude !== undefined;
    const hasLongitude = region.longitude !== null && region.longitude !== undefined;
    if (!name) throw new BadRequestException('Region name must not be empty');
    if (hasLatitude !== hasLongitude) throw new BadRequestException('Region coordinates must include both latitude and longitude');
    const key = googlePlaceId ?? `${name.toLocaleLowerCase()}|${address?.toLocaleLowerCase() ?? ''}`;
    if (seen.has(key)) throw new BadRequestException('Duplicate trip region');
    seen.add(key);
    return {
      googlePlaceId,
      name,
      address,
      latitude: region.latitude ?? null,
      longitude: region.longitude ?? null,
    };
  });
}
