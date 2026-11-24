import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { ROUTES_PORT, type RouteTravelMode, type RoutesPort } from '../domain/routes.port';
import { TransitRouteRequestDto, TransitRouteResponseDto, TransitRouteStatus } from './dto/transit-route.dto';
import { writeStructuredLog } from '../../../common/http/json-logger';

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
    if (Boolean(input.originSavedPlaceId) === Boolean(input.originBoundaryType)
      || Boolean(input.destinationSavedPlaceId) === Boolean(input.destinationBoundaryType)) {
      throw new BadRequestException('Specify exactly one saved place or boundary per endpoint');
    }
    const ids = [input.originSavedPlaceId, input.destinationSavedPlaceId].filter((id): id is string => Boolean(id));
    const places = ids.length ? await this.places.findBy({ id: In(ids), tripId }) : [];
    const resolve = (id?: string, boundary?: string): string | null => {
      if (boundary) {
        const point = boundary === 'start_point' ? trip.startPoint : trip.endPoint;
        if (!point) throw new NotFoundException('Trip boundary not found');
        return point.googlePlaceId;
      }
      const place = places.find((candidate) => candidate.id === id);
      if (!place) throw new NotFoundException('Saved place not found');
      return place.googlePlaceId;
    };
    const originGooglePlaceId = resolve(input.originSavedPlaceId, input.originBoundaryType);
    const destinationGooglePlaceId = resolve(input.destinationSavedPlaceId, input.destinationBoundaryType);
    if (!originGooglePlaceId || !destinationGooglePlaceId) return this.unavailable('PLACE_ID_MISSING');
    if (originGooglePlaceId === destinationGooglePlaceId) {
      return {
        status: TransitRouteStatus.Available, durationMinutes: 0, distanceMeters: 0,
        reason: null, travelMode: 'walking', isFallback: false,
      };
    }

    try {
      const configuredModes = trip.latestAiPlanRequest?.transportModes ?? [];
      const fallbackTravelModes = preferredFallbackModes(configuredModes);
      const estimate = await this.routes.transit({
        originGooglePlaceId,
        destinationGooglePlaceId,
        departureTime: input.departureTime,
        fallbackTravelModes,
      });
      if (!estimate) {
        writeStructuredLog('warn', 'routes.transit.not_found', {
          tripId, departureTime: input.departureTime ?? null,
          attemptedModes: ['public_transit', ...fallbackTravelModes],
        });
        return this.unavailable('ROUTE_NOT_FOUND');
      }
      if (estimate.isFallback) {
        writeStructuredLog('info', 'routes.transit.fallback', {
          tripId, travelMode: estimate.travelMode, durationMinutes: estimate.durationMinutes,
        });
      }
      return { status: TransitRouteStatus.Available, ...estimate, reason: null };
    } catch (error) {
      writeStructuredLog('warn', 'routes.transit.provider_failed', {
        tripId,
        error: error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' },
      });
      return this.unavailable('PROVIDER_FAILURE');
    }
  }

  private unavailable(reason: string): TransitRouteResponseDto {
    return {
      status: TransitRouteStatus.Unavailable, durationMinutes: null, distanceMeters: null,
      reason, travelMode: null, isFallback: false,
    };
  }
}

function preferredFallbackModes(configuredModes: string[]): Array<Exclude<RouteTravelMode, 'public_transit'>> {
  const selected = new Set(configuredModes);
  const result: Array<'walking' | 'car'> = [];
  if (selected.has('walking')) result.push('walking');
  if (selected.has('car')) result.push('car');
  // Walking remains a truthful first/last-mile alternative when Google's transit
  // coverage returns no route, even for older trips that stored no preferences.
  if (!selected.has('walking')) result.push('walking');
  return result;
}
