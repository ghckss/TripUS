import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { PlacePreference, PlaceTag, type SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import type { TripEntity } from '../../trips/domain/entities/trip.entity';
import { ItineraryItemEntity } from '../domain/entities/itinerary-item.entity';
import { addTripBoundaryPoints, ItinerariesService } from './itineraries.service';

describe('trip boundary itinerary items', () => {
  it('adds the configured start first and configured end last', () => {
    const items = [
      { id: 'visit-1', savedPlaceId: 'place-1', placeName: '경복궁', date: '2026-11-08', position: 0 },
      { id: 'visit-2', savedPlaceId: 'place-2', placeName: '서울숲', date: '2026-11-10', position: 0 },
    ] as never;
    const result = addTripBoundaryPoints(items, {
      id: '10000000-0000-4000-8000-000000000001',
      startDate: '2026-11-08',
      endDate: '2026-11-10',
      startPoint: { googlePlaceId: 'airport-1', name: '인천공항 제1터미널', address: '인천', latitude: 37.46, longitude: 126.44, time: '09:30' },
      endPoint: { googlePlaceId: 'airport-2', name: '인천공항 제2터미널', address: '인천', latitude: 37.46, longitude: 126.43, time: '18:00' },
    }, 37);

    expect(result.filter((item) => item.date === '2026-11-08').map((item) => [item.boundaryType, item.placeName, item.position])).toEqual([
      ['start_point', '인천공항 제1터미널', 0],
      [undefined, '경복궁', 1],
    ]);
    expect(result.filter((item) => item.date === '2026-11-10').map((item) => [item.boundaryType, item.placeName, item.position])).toEqual([
      [undefined, '서울숲', 0],
      ['end_point', '인천공항 제2터미널', 1],
    ]);
    expect(result.at(-1)?.travelDurationMinutes).toBe(37);
  });
});

describe('ItinerariesService', () => {
  it('recalculates travel time between user-reordered or newly added places', async () => {
    const tripId = '10000000-0000-4000-8000-000000000001';
    const makeVisit = (id: string, position: number, googlePlaceId: string) => ({
      id, tripId, savedPlaceId: `place-${id}`, date: '2026-11-08', position,
      scheduledTime: null, durationMinutes: null, activitySummary: null,
      travelMethod: null, travelDurationMinutes: position === 1 ? 99 : null,
      locked: false, source: 'manual', visitStatus: null, rating: null, review: null,
      savedPlace: { name: id, address: null, latitude: null, longitude: null, googlePlaceId },
    });
    const items = { find: vi.fn().mockResolvedValue([
      makeVisit('first', 0, 'google-first'), makeVisit('second', 1, 'google-second'),
    ]) };
    const service = new ItinerariesService(
      items as unknown as Repository<ItineraryItemEntity>,
      { find: vi.fn().mockResolvedValue([]) } as unknown as Repository<SavedPlaceEntity>,
      { findOneBy: vi.fn().mockResolvedValue({
        id: tripId, active: true, startDate: '2026-11-08', endDate: '2026-11-08', startPoint: null, endPoint: null,
      }) } as unknown as Repository<TripEntity>,
      {} as DataSource,
      { getCurrentUserId: vi.fn().mockReturnValue('user-1') },
      { transit: vi.fn().mockResolvedValue({ durationMinutes: 23, distanceMeters: 5_000 }) },
    );

    const result = await service.get(tripId);

    expect(result.items[1]).toMatchObject({ placeName: 'second', travelMethod: '대중교통', travelDurationMinutes: 23 });
  });

  it('calculates travel time from the final visit to the configured end point', async () => {
    const tripId = '10000000-0000-4000-8000-000000000001';
    const visit = {
      id: '30000000-0000-4000-8000-000000000001',
      tripId,
      savedPlaceId: '20000000-0000-4000-8000-000000000001',
      date: '2026-11-08',
      position: 0,
      scheduledTime: null,
      durationMinutes: null,
      activitySummary: null,
      travelMethod: null,
      travelDurationMinutes: null,
      locked: false,
      source: 'ai',
      visitStatus: null,
      rating: null,
      review: null,
      savedPlace: { name: '경복궁', address: '서울 종로구', latitude: 37.5796, longitude: 126.977, googlePlaceId: 'visit-google-id' },
    };
    const items = { find: vi.fn().mockResolvedValue([visit]) };
    const places = { find: vi.fn().mockResolvedValue([]) };
    const trips = { findOneBy: vi.fn().mockResolvedValue({
      id: tripId,
      active: true,
      startDate: '2026-11-08',
      endDate: '2026-11-08',
      startPoint: { googlePlaceId: 'start-google-id', name: '서울역', time: '09:00' },
      endPoint: { googlePlaceId: 'end-google-id', name: '인천공항', time: '18:00' },
    }) };
    const identity = { getCurrentUserId: vi.fn().mockReturnValue('user-1') };
    const routes = { transit: vi.fn()
      .mockResolvedValueOnce({ durationMinutes: 14, distanceMeters: 3_000 })
      .mockResolvedValueOnce({ durationMinutes: 61, distanceMeters: 58_000 }) };
    const service = new ItinerariesService(
      items as unknown as Repository<ItineraryItemEntity>,
      places as unknown as Repository<SavedPlaceEntity>,
      trips as unknown as Repository<TripEntity>,
      {} as DataSource,
      identity,
      routes,
    );

    const result = await service.get(tripId);

    expect(routes.transit).toHaveBeenNthCalledWith(1, { originGooglePlaceId: 'start-google-id', destinationGooglePlaceId: 'visit-google-id' });
    expect(routes.transit).toHaveBeenNthCalledWith(2, { originGooglePlaceId: 'visit-google-id', destinationGooglePlaceId: 'end-google-id' });
    expect(result.items.map((item) => [item.boundaryType, item.travelDurationMinutes])).toEqual([
      ['start_point', null],
      [null, 14],
      ['end_point', 61],
    ]);
  });

  it('does not expose lodging as an unplaced travel place', async () => {
    const tripId = '10000000-0000-4000-8000-000000000001';
    const items = { find: vi.fn().mockResolvedValue([]) };
    const places = { find: vi.fn().mockResolvedValue([
      { id: '20000000-0000-4000-8000-000000000001', tripId, name: '감천문화마을', tag: PlaceTag.Attraction, preference: PlacePreference.MustVisit, isPrimaryLodging: false },
      { id: '20000000-0000-4000-8000-000000000002', tripId, name: '기본 호텔', tag: PlaceTag.Lodging, preference: PlacePreference.WantToVisit, isPrimaryLodging: true },
    ]) };
    const trips = { findOneBy: vi.fn().mockResolvedValue({
      id: tripId, active: true, startDate: '2026-11-08', endDate: '2026-11-10', startPoint: null, endPoint: null,
    }) };
    const identity = { getCurrentUserId: vi.fn().mockReturnValue('user-1') };
    const routes = { transit: vi.fn() };

    const service = new ItinerariesService(
      items as unknown as Repository<ItineraryItemEntity>,
      places as unknown as Repository<SavedPlaceEntity>,
      trips as unknown as Repository<TripEntity>,
      {} as DataSource,
      identity,
      routes,
    );

    await expect(service.get(tripId)).resolves.toEqual({
      items: [],
      unplaced: [{ savedPlaceId: '20000000-0000-4000-8000-000000000001', placeName: '감천문화마을' }],
    });
  });

  it('allows the same saved place on different dates', async () => {
    const tripId = '10000000-0000-4000-8000-000000000001';
    const savedPlaceId = '20000000-0000-4000-8000-000000000001';
    const items = { find: vi.fn().mockResolvedValue([]) };
    const places = {
      countBy: vi.fn().mockResolvedValue(1),
      find: vi.fn().mockResolvedValue([]),
    };
    const trips = { findOneBy: vi.fn().mockResolvedValue({
      id: tripId, active: true, startDate: '2026-11-08', endDate: '2026-11-10', startPoint: null, endPoint: null,
    }) };
    const manager = {
      create: vi.fn((_entity: typeof ItineraryItemEntity, value: Partial<ItineraryItemEntity>) => value as ItineraryItemEntity),
      delete: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const dataSource = { transaction: vi.fn(async (callback: (transactionManager: typeof manager) => Promise<void>) => callback(manager)) };
    const identity = { getCurrentUserId: vi.fn().mockReturnValue('user-1') };
    const routes = { transit: vi.fn() };
    const service = new ItinerariesService(
      items as unknown as Repository<ItineraryItemEntity>,
      places as unknown as Repository<SavedPlaceEntity>,
      trips as unknown as Repository<TripEntity>,
      dataSource as unknown as DataSource,
      identity,
      routes,
    );

    const result = await service.replace(tripId, [
      { savedPlaceId, date: '2026-11-08', position: 0 },
      { savedPlaceId, date: '2026-11-09', position: 0 },
    ]);

    expect(result.status).toBe('updated');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(ItineraryItemEntity, expect.arrayContaining([
      expect.objectContaining({ savedPlaceId, date: '2026-11-08' }),
      expect.objectContaining({ savedPlaceId, date: '2026-11-09' }),
    ]));
  });

  it('replaces only the requested date', async () => {
    const tripId = '10000000-0000-4000-8000-000000000001';
    const savedPlaceId = '20000000-0000-4000-8000-000000000001';
    const items = { find: vi.fn().mockResolvedValue([]) };
    const places = { countBy: vi.fn().mockResolvedValue(1), find: vi.fn().mockResolvedValue([]) };
    const trips = { findOneBy: vi.fn().mockResolvedValue({
      id: tripId, active: true, startDate: '2026-11-08', endDate: '2026-11-10', startPoint: null, endPoint: null,
    }) };
    const manager = {
      create: vi.fn((_entity: typeof ItineraryItemEntity, value: Partial<ItineraryItemEntity>) => value as ItineraryItemEntity),
      delete: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const dataSource = { transaction: vi.fn(async (callback: (transactionManager: typeof manager) => Promise<void>) => callback(manager)) };
    const service = new ItinerariesService(
      items as unknown as Repository<ItineraryItemEntity>,
      places as unknown as Repository<SavedPlaceEntity>,
      trips as unknown as Repository<TripEntity>,
      dataSource as unknown as DataSource,
      { getCurrentUserId: vi.fn().mockReturnValue('user-1') },
      { transit: vi.fn() },
    );

    const result = await service.replaceDay(tripId, '2026-11-09', [
      { savedPlaceId, date: '2026-11-09', position: 0, scheduledTime: '10:30' },
    ]);

    expect(result.status).toBe('updated');
    expect(manager.delete).toHaveBeenCalledWith(ItineraryItemEntity, { tripId, date: '2026-11-09' });
    expect(manager.save).toHaveBeenCalledWith(ItineraryItemEntity, [
      expect.objectContaining({ savedPlaceId, date: '2026-11-09', scheduledTime: '10:30' }),
    ]);
  });
});
