import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { SavedPlaceEntity } from '../domain/entities/saved-place.entity';
import { PLACE_SEARCH_PORT, type PlaceSearchPort } from '../domain/place-search.port';
import { CreateSavedPlaceDto } from './dto/create-saved-place.dto';
import { SavedPlaceResponseDto, SavePlaceResultDto, SavePlaceStatus } from './dto/saved-place-response.dto';
import { PlaceSearchCandidateDto } from './dto/search-places.dto';
import { UpdateSavedPlaceDto } from './dto/update-saved-place.dto';

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(SavedPlaceEntity)
    private readonly places: Repository<SavedPlaceEntity>,
    @InjectRepository(TripEntity)
    private readonly trips: Repository<TripEntity>,
    @Inject(IDENTITY_PORT)
    private readonly identity: IdentityPort,
    @Inject(PLACE_SEARCH_PORT)
    private readonly placeSearch: PlaceSearchPort,
  ) {}

  async search(tripId: string, query: string): Promise<PlaceSearchCandidateDto[]> {
    const trip = await this.assertOwnedActiveTrip(tripId);
    return this.placeSearch.search(query, trip.destination);
  }

  searchByDestination(query: string, destination: string): Promise<PlaceSearchCandidateDto[]> {
    return this.placeSearch.search(query, destination);
  }

  async list(tripId: string): Promise<SavedPlaceResponseDto[]> {
    await this.assertOwnedActiveTrip(tripId);
    const entities = await this.places.find({ where: { tripId }, order: { createdAt: 'DESC' } });
    return entities.map((entity) => SavedPlaceResponseDto.fromEntity(entity));
  }

  async create(tripId: string, input: CreateSavedPlaceDto): Promise<SavePlaceResultDto> {
    await this.assertOwnedActiveTrip(tripId);
    const existing = await this.findByGooglePlaceId(tripId, input.googlePlaceId);
    if (existing) {
      return this.result(SavePlaceStatus.AlreadyExists, existing);
    }

    const entity = this.places.create({
      tripId,
      googlePlaceId: input.googlePlaceId ?? null,
      name: input.name,
      address: input.address ?? null,
      tag: input.tag,
      preference: input.preference,
      note: input.note ?? null,
    });

    try {
      return this.result(SavePlaceStatus.Created, await this.places.save(entity));
    } catch (error) {
      if (input.googlePlaceId && this.isUniqueViolation(error)) {
        const raced = await this.findByGooglePlaceId(tripId, input.googlePlaceId);
        if (raced) {
          return this.result(SavePlaceStatus.AlreadyExists, raced);
        }
      }
      throw error;
    }
  }

  async update(tripId: string, placeId: string, input: UpdateSavedPlaceDto): Promise<SavedPlaceResponseDto> {
    await this.assertOwnedActiveTrip(tripId);
    const entity = await this.findSavedPlace(tripId, placeId);
    Object.assign(entity, input);
    return SavedPlaceResponseDto.fromEntity(await this.places.save(entity));
  }

  async remove(tripId: string, placeId: string): Promise<void> {
    await this.assertOwnedActiveTrip(tripId);
    const entity = await this.findSavedPlace(tripId, placeId);
    await this.places.remove(entity);
  }

  private async assertOwnedActiveTrip(tripId: string): Promise<TripEntity> {
    const trip = await this.trips.findOneBy({
      id: tripId,
      ownerId: this.identity.getCurrentUserId(),
      active: true,
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    return trip;
  }

  private findByGooglePlaceId(tripId: string, googlePlaceId?: string): Promise<SavedPlaceEntity | null> {
    return googlePlaceId
      ? this.places.findOneBy({ tripId, googlePlaceId })
      : Promise.resolve(null);
  }

  private async findSavedPlace(tripId: string, placeId: string): Promise<SavedPlaceEntity> {
    const entity = await this.places.findOneBy({ id: placeId, tripId });
    if (!entity) throw new NotFoundException('Saved place not found');
    return entity;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    return (error.driverError as { code?: string }).code === '23505';
  }

  private result(status: SavePlaceStatus, entity: SavedPlaceEntity): SavePlaceResultDto {
    return { status, place: SavedPlaceResponseDto.fromEntity(entity) };
  }
}
