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
  const placeSearchSearch = vi.fn<PlaceSearchPort['search']>();
  const placeSearchGetCoordinates = vi.fn<PlaceSearchPort['getCoordinates']>();
  const placeSearch: PlaceSearchPort = { search: placeSearchSearch, getCoordinates: placeSearchGetCoordinates };
  return {
    places,
    placeSearchSearch,
    placeSearchGetCoordinates,
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
  it('searches a destination before a trip is created', async () => {
    const { placeSearchSearch, service } = createService();
    placeSearchSearch.mockResolvedValue([]);

    await expect(service.searchByDestination('도쿄 호텔', '일본')).resolves.toEqual([]);
    expect(placeSearchSearch).toHaveBeenCalledWith('도쿄 호텔', '일본');
  });

  it('loads city choices for a selected country', async () => {
    const { service } = createService();

    const cities = await service.searchCities('Tokyo', '일본', 'JP');
    expect(cities).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '도쿄', address: '일본', primaryType: 'locality' }),
    ]));
  });

  it('limits the default dropdown to 20 population-ranked localized cities', async () => {
    const { placeSearchSearch, service } = createService();

    const cities = await service.searchCities('주요 도시', '일본', 'JP');

    expect(cities).toHaveLength(20);
    expect(cities.slice(0, 5).map((city) => city.name)).toEqual(['도쿄', '요코하마', '오사카', '나고야', '삿포로']);
    expect(placeSearchSearch).not.toHaveBeenCalled();
  });

  it('searches the catalog with a localized city query', async () => {
    const { placeSearchSearch, service } = createService();

    await expect(service.searchCities('도쿄', '일본', 'JP')).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ googlePlaceId: 'catalog:geonames:1850147', name: '도쿄' }),
    ]));
    expect(placeSearchSearch).not.toHaveBeenCalled();
  });

  it('falls back to place discovery when a city is missing from the compact catalog', async () => {
    const { placeSearchSearch, service } = createService();
    placeSearchSearch.mockResolvedValue([{
      googlePlaceId: 'city-google', name: '작은 도시', address: '일본', primaryType: 'locality',
      latitude: 35.67, longitude: 139.65,
    }]);

    await expect(service.searchCities('작은 도시', '일본', 'JP')).resolves.toEqual([
      expect.objectContaining({ googlePlaceId: 'city-google', name: '작은 도시' }),
    ]);
    expect(placeSearchSearch).toHaveBeenCalledWith('작은 도시', '일본');
  });

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

  it('backfills coordinates for an existing Google place', async () => {
    const { placeSearchGetCoordinates, places, service, trips } = createService();
    const place = {
      id: '20000000-0000-4000-8000-000000000001', tripId, googlePlaceId: 'google-place-1',
      name: '서촌 골목', address: '서울', latitude: null, longitude: null,
      tag: PlaceTag.Attraction, preference: PlacePreference.MustVisit, note: null, isPrimaryLodging: false,
    } as SavedPlaceEntity;
    trips.findOneBy.mockResolvedValue({ id: tripId });
    places.find.mockResolvedValue([place]);
    places.save.mockResolvedValue(place);
    placeSearchGetCoordinates.mockResolvedValue({ latitude: 37.5796, longitude: 126.9718 });

    const result = await service.list(tripId);

    expect(placeSearchGetCoordinates).toHaveBeenCalledWith('google-place-1');
    expect(places.save).toHaveBeenCalledWith(expect.objectContaining({ latitude: 37.5796, longitude: 126.9718 }));
    expect(result[0]).toMatchObject({ latitude: 37.5796, longitude: 126.9718 });
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
