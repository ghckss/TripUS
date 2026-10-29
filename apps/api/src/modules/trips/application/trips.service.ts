import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { CreateTripDto } from './dto/create-trip.dto';
import { TripResponseDto } from './dto/trip-response.dto';
import { TripEntity } from '../domain/entities/trip.entity';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(TripEntity)
    private readonly trips: Repository<TripEntity>,
    @Inject(IDENTITY_PORT)
    private readonly identity: IdentityPort,
  ) {}

  async list(): Promise<TripResponseDto[]> {
    const entities = await this.trips.find({
      where: { ownerId: this.identity.getCurrentUserId(), active: true },
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
    const entity = await this.trips.findOneBy({
      id: tripId,
      ownerId: this.identity.getCurrentUserId(),
      active: true,
    });
    if (!entity) {
      throw new NotFoundException('Trip not found');
    }
    return TripResponseDto.fromEntity(entity);
  }
}
