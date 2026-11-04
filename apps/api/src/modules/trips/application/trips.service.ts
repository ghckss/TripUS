import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { CreateTripDto } from './dto/create-trip.dto';
import { TripResponseDto } from './dto/trip-response.dto';
import { TripEntity } from '../domain/entities/trip.entity';
import { TripListStatus } from './dto/list-trips-query.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(TripEntity)
    private readonly trips: Repository<TripEntity>,
    @Inject(IDENTITY_PORT)
    private readonly identity: IdentityPort,
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
    const entity = this.trips.create({
      ...input,
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
    Object.assign(entity, input);
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
