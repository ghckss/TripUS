import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { IdentityPort } from '../../identity/domain/identity.port';
import { SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { TripDaySettingEntity } from '../domain/entities/trip-day-setting.entity';
import { TripDaySettingsService } from './trip-day-settings.service';

const tripId = '10000000-0000-4000-8000-000000000001';
const lodgingId = '20000000-0000-4000-8000-000000000001';

function createService(stored: Partial<TripDaySettingEntity>[] = []) {
  const settings = { find: vi.fn().mockResolvedValue(stored) };
  const trips = {
    findOneBy: vi.fn().mockResolvedValue({
      id: tripId,
      startDate: '2026-11-08',
      endDate: '2026-11-09',
    }),
  };
  const places = {
    find: vi.fn().mockResolvedValue([{ id: lodgingId, name: '부산 바다 호텔' }]),
  };
  const identity: IdentityPort = { getCurrentUserId: () => 'user-1' };
  const service = new TripDaySettingsService(
    settings as unknown as Repository<TripDaySettingEntity>,
    trips as unknown as Repository<TripEntity>,
    places as unknown as Repository<SavedPlaceEntity>,
    {} as DataSource,
    identity,
  );
  return { places, service };
}

describe('TripDaySettingsService', () => {
  it('uses the first lodging as the default for dates without saved settings', async () => {
    const { places, service } = createService();

    const result = await service.get(tripId);

    expect(places.find).toHaveBeenCalledWith(expect.objectContaining({
      order: { createdAt: 'ASC' },
    }));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      startPlaceId: lodgingId,
      startPlaceName: '부산 바다 호텔',
      endPlaceId: lodgingId,
      endPlaceName: '부산 바다 호텔',
    });
  });

  it('preserves an explicit no-lodging choice saved for a date', async () => {
    const { service } = createService([{
      date: '2026-11-08',
      startTime: '10:00:00',
      endTime: '20:00:00',
      startPlaceId: null,
      endPlaceId: null,
    }]);

    const result = await service.get(tripId);

    expect(result[0]).toMatchObject({ startPlaceId: null, endPlaceId: null });
    expect(result[1]).toMatchObject({ startPlaceId: lodgingId, endPlaceId: lodgingId });
  });
});
