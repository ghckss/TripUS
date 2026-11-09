import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { PlacePreference, PlaceTag, type SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import type { TripEntity } from '../../trips/domain/entities/trip.entity';
import type { ItineraryItemEntity } from '../domain/entities/itinerary-item.entity';
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
});
