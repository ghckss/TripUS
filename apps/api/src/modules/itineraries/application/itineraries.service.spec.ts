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
    });

    expect(result.filter((item) => item.date === '2026-11-08').map((item) => [item.boundaryType, item.placeName, item.position])).toEqual([
      ['start_point', '인천공항 제1터미널', 0],
      [undefined, '경복궁', 1],
    ]);
    expect(result.filter((item) => item.date === '2026-11-10').map((item) => [item.boundaryType, item.placeName, item.position])).toEqual([
      [undefined, '서울숲', 0],
      ['end_point', '인천공항 제2터미널', 1],
    ]);
    expect(result.at(-1)?.travelDurationMinutes).toBeNull();
  });
});

describe('ItinerariesService', () => {
  it('does not expose old model travel times or invoke route APIs during itinerary reads', async () => {
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
    );

    const result = await service.get(tripId);

    expect(result.items[1]).toMatchObject({ placeName: 'second', travelMethod: null, travelDurationMinutes: null });
  });

  it('leaves boundary leg durations to explicit route requests', async () => {
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
    const service = new ItinerariesService(
      items as unknown as Repository<ItineraryItemEntity>,
      places as unknown as Repository<SavedPlaceEntity>,
      trips as unknown as Repository<TripEntity>,
      {} as DataSource,
      identity,
    );

    const result = await service.get(tripId);

    expect(result.items.map((item) => [item.boundaryType, item.travelDurationMinutes])).toEqual([
      ['start_point', null],
      [null, null],
      ['end_point', null],
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

    const service = new ItinerariesService(
      items as unknown as Repository<ItineraryItemEntity>,
      places as unknown as Repository<SavedPlaceEntity>,
      trips as unknown as Repository<TripEntity>,
      {} as DataSource,
      identity,
    );

    await expect(service.get(tripId)).resolves.toEqual({
      activities: [],
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
    const service = new ItinerariesService(
      items as unknown as Repository<ItineraryItemEntity>,
      places as unknown as Repository<SavedPlaceEntity>,
      trips as unknown as Repository<TripEntity>,
      dataSource as unknown as DataSource,
      identity,
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

describe('independent itinerary activities', () => {
  const activity = {
    id: '40000000-0000-4000-8000-000000000001', date: '2026-11-08', position: 0,
    type: 'arrival' as const, title: '입국 심사 및 수하물 수령', startTime: '12:00', durationMinutes: 90,
    locationType: 'start_point' as const, savedPlaceId: null, locationName: 'CDG',
    fromLocation: null, toLocation: null, travelMethod: null,
  };
  function setup() {
    const trip = { id: 'trip', startDate: '2026-11-08', endDate: '2026-11-10', startPoint: null, endPoint: null,
      itineraryActivities: [activity, { ...activity, id: 'other', date: '2026-11-09' }] };
    const manager = { delete: vi.fn(), update: vi.fn().mockResolvedValue({ affected: 1 }) };
    const transit = vi.fn();
    const items = { find: vi.fn().mockResolvedValue([]) };
    const service = new ItinerariesService(
      items as never,
      { find: vi.fn().mockResolvedValue([]), countBy: vi.fn().mockResolvedValue(0) } as never,
      { findOneBy: vi.fn().mockResolvedValue(trip) } as never,
      { transaction: vi.fn(async (fn: (m: typeof manager) => Promise<void>) => fn(manager)) } as never,
      { getCurrentUserId: () => 'user' },
    );
    return { service, trip, manager, transit, items };
  }
  it('persists non-place activities atomically with a replacement and returns them after reload', async () => {
    const { service, manager } = setup();
    const result = await service.replace('trip', [], undefined, [activity]);
    expect(result.itinerary.activities).toEqual([activity]);
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'trip' }, { itineraryActivities: [activity] });
    expect((await service.get('trip')).activities).toEqual([activity]);
  });
  it('does not expose retired explanation fields from stored activity JSON', async () => {
    const { service, trip } = setup();
    const legacyActivity = { ...activity, reason: 'old generated explanation' };
    trip.itineraryActivities = [legacyActivity];
    expect((await service.get('trip')).activities).toEqual([activity]);
    expect(trip.itineraryActivities[0]).toHaveProperty('reason');
  });
  it('replaces only the selected day activities and preserves the other dates', async () => {
    const { service } = setup();
    const result = await service.replaceDay('trip', '2026-11-08', [], undefined, []);
    expect(result.itinerary.activities?.map((item) => item.date)).toEqual(['2026-11-09']);
  });
  it('preserves activities for older manual clients that omit the activities field; explicit [] clears them', async () => {
    const { service, manager } = setup();
    expect((await service.replace('trip', [])).itinerary.activities).toHaveLength(2);
    expect(manager.update).not.toHaveBeenCalled();
    expect((await service.replace('trip', [], undefined, [])).itinerary.activities).toEqual([]);
  });
  it('does not add direct place-to-place route estimates on a date with explicit activities', async () => {
    const { service, items, transit } = setup();
    items.find.mockResolvedValue(['first', 'second'].map((id, position) => ({
      id, savedPlaceId: id, date: activity.date, position, scheduledTime: '17:00', travelDurationMinutes: 0,
      savedPlace: { name: id, googlePlaceId: id, address: null, latitude: null, longitude: null },
    })));
    const result = await service.get('trip');
    expect(result.items[1]?.travelDurationMinutes).toBeNull();
    expect(transit).not.toHaveBeenCalled();
  });
  it('rejects out-of-scope activity dates without changing stored activities', async () => {
    const { service, manager } = setup();
    const result = await service.replaceDay('trip', '2026-11-08', [], undefined, [{ ...activity, date: '2026-11-09' }]);
    expect(result.conflicts).toEqual(['DATE_SCOPE_MISMATCH']);
    expect(manager.update).not.toHaveBeenCalled();
  });
});
