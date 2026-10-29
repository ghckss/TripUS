import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { ROUTES_PORT, type RoutesPort } from '../domain/routes.port';
import { TransitRouteRequestDto, TransitRouteResponseDto, TransitRouteStatus } from './dto/transit-route.dto';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(SavedPlaceEntity) private readonly places: Repository<SavedPlaceEntity>,
    @Inject(ROUTES_PORT) private readonly routes: RoutesPort,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  async transit(tripId: string, input: TransitRouteRequestDto): Promise<TransitRouteResponseDto> {
    const trip = await this.trips.findOneBy({ id: tripId, ownerId: this.identity.getCurrentUserId(), active: true });
    if (!trip) throw new NotFoundException('Trip not found');
    const places = await this.places.findBy({ id: In([input.originSavedPlaceId, input.destinationSavedPlaceId]), tripId });
    const origin = places.find((place) => place.id === input.originSavedPlaceId);
    const destination = places.find((place) => place.id === input.destinationSavedPlaceId);
    if (!origin || !destination) throw new NotFoundException('Saved place not found');
    if (!origin.googlePlaceId || !destination.googlePlaceId) return this.unavailable('PLACE_ID_MISSING');

    try {
      const estimate = await this.routes.transit({
        originGooglePlaceId: origin.googlePlaceId,
        destinationGooglePlaceId: destination.googlePlaceId,
        departureTime: input.departureTime,
      });
      return estimate
        ? { status: TransitRouteStatus.Available, ...estimate, reason: null }
        : this.unavailable('ROUTE_NOT_FOUND');
    } catch {
      return this.unavailable('PROVIDER_FAILURE');
    }
  }

  private unavailable(reason: string): TransitRouteResponseDto {
    return { status: TransitRouteStatus.Unavailable, durationMinutes: null, distanceMeters: null, reason };
  }
}
