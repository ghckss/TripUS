import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { TripDaySettingEntity } from '../domain/entities/trip-day-setting.entity';
import { TripDaySettingsService } from './trip-day-settings.service';

const tripId = '10000000-0000-4000-8000-000000000001';
function createService(stored: Partial<TripDaySettingEntity>[] = []) {
  const settings = { find: vi.fn().mockResolvedValue(stored) };
  const trips = {
    findOneBy: vi.fn().mockResolvedValue({
      id: tripId,
      startDate: '2026-11-08',
      endDate: '2026-11-09',
    }),
  };
  const identity: IdentityPort = { getCurrentUserId: () => 'user-1' };
  const service = new TripDaySettingsService(
    settings as unknown as Repository<TripDaySettingEntity>,
    trips as unknown as Repository<TripEntity>,
    {} as DataSource,
    identity,
  );
  return { service };
}

describe('TripDaySettingsService', () => {
  it('uses default activity times for dates without saved settings', async () => {
    const { service } = createService();

    const result = await service.get(tripId);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      date: '2026-11-08',
      startTime: '09:00',
      endTime: '21:00',
    });
  });

  it('preserves saved activity times for a date', async () => {
    const { service } = createService([{
      date: '2026-11-08',
      startTime: '10:00:00',
      endTime: '20:00:00',
    }]);

    const result = await service.get(tripId);

    expect(result[0]).toMatchObject({ startTime: '10:00', endTime: '20:00' });
    expect(result[1]).toMatchObject({ startTime: '09:00', endTime: '21:00' });
  });
});
