import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import {
  PlacePreference,
  PlaceTag,
  SavedPlaceEntity,
} from '../domain/entities/saved-place.entity';
import { SavePlaceStatus } from './dto/saved-place-response.dto';
import { PlacesService } from './places.service';
import type { PlaceSearchPort } from '../domain/place-search.port';

const userId = '00000000-0000-4000-8000-000000000001';
const tripId = '10000000-0000-4000-8000-000000000001';

function createService() {
  const places = {
    create: vi.fn((value: Partial<SavedPlaceEntity>) => value as SavedPlaceEntity),
    find: vi.fn(),
    findOneBy: vi.fn(),
    remove: vi.fn(),
    save: vi.fn(),
  };
  const trips = { findOneBy: vi.fn() };
  const identity: IdentityPort = { getCurrentUserId: () => userId };
  const placeSearch: PlaceSearchPort = { search: vi.fn() };
  return {
    places,
    trips,
    service: new PlacesService(
      places as unknown as Repository<SavedPlaceEntity>,
      trips as unknown as Repository<TripEntity>,
      identity,
      placeSearch,
    ),
  };
}

describe('PlacesService', () => {
  it('returns the existing place for a duplicate Google Place ID', async () => {
    const { places, service, trips } = createService();
    trips.findOneBy.mockResolvedValue({ id: tripId });
    places.findOneBy.mockResolvedValue({
      id: '20000000-0000-4000-8000-000000000001',
      tripId,
      googlePlaceId: 'google-place-1',
      name: '서촌 골목',
      address: null,
      tag: PlaceTag.Attraction,
      preference: PlacePreference.MustVisit,
      note: null,
    });

    const result = await service.create(tripId, {
      googlePlaceId: 'google-place-1',
      name: '서촌 골목',
      tag: PlaceTag.Attraction,
      preference: PlacePreference.MustVisit,
    });

    expect(result.status).toBe(SavePlaceStatus.AlreadyExists);
    expect(places.save).not.toHaveBeenCalled();
  });

  it('hides places when the trip is not owned by the current user', async () => {
    const { places, service, trips } = createService();
    trips.findOneBy.mockResolvedValue(null);

    await expect(service.list(tripId)).rejects.toBeInstanceOf(NotFoundException);
    expect(trips.findOneBy).toHaveBeenCalledWith({ id: tripId, ownerId: userId, active: true });
    expect(places.find).not.toHaveBeenCalled();
  });

  it('deletes a saved place only after checking trip ownership', async () => {
    const { places, service, trips } = createService();
    const place = { id: '20000000-0000-4000-8000-000000000001', tripId } as SavedPlaceEntity;
    trips.findOneBy.mockResolvedValue({ id: tripId });
    places.findOneBy.mockResolvedValue(place);

    await service.remove(tripId, place.id);

    expect(trips.findOneBy).toHaveBeenCalledWith({ id: tripId, ownerId: userId, active: true });
    expect(places.remove).toHaveBeenCalledWith(place);
  });
});
