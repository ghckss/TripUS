import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { PlacePreference, PlaceTag, type SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import type { TripEntity } from '../../trips/domain/entities/trip.entity';
import { ItineraryItemEntity } from '../domain/entities/itinerary-item.entity';
import { ItinerariesService } from './itineraries.service';

describe('ItinerariesService', () => {
  it('does not expose lodging as an unplaced travel place', async () => {
    const tripId = '10000000-0000-4000-8000-000000000001';
    const items = { find: vi.fn().mockResolvedValue([]) };
    const places = { find: vi.fn().mockResolvedValue([
      { id: '20000000-0000-4000-8000-000000000001', tripId, name: '감천문화마을', tag: PlaceTag.Attraction, preference: PlacePreference.MustVisit, isPrimaryLodging: false },
      { id: '20000000-0000-4000-8000-000000000002', tripId, name: '기본 호텔', tag: PlaceTag.Lodging, preference: PlacePreference.WantToVisit, isPrimaryLodging: true },
    ]) };
    const trips = { findOneBy: vi.fn().mockResolvedValue({ id: tripId, active: true }) };
    const identity = { getCurrentUserId: vi.fn().mockReturnValue('user-1') };

    const service = new ItinerariesService(
      items as unknown as Repository<ItineraryItemEntity>,
      places as unknown as Repository<SavedPlaceEntity>,
      trips as unknown as Repository<TripEntity>,
      {} as DataSource,
      identity,
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
    const trips = { findOneBy: vi.fn().mockResolvedValue({ id: tripId, active: true, startDate: '2026-11-08', endDate: '2026-11-10' }) };
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
});
