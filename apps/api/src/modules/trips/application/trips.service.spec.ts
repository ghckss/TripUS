import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../domain/entities/trip.entity';
import { TripsService } from './trips.service';

const userId = '00000000-0000-4000-8000-000000000001';

function createService() {
  const repository = {
    create: vi.fn((value: Partial<TripEntity>) => value as TripEntity),
    find: vi.fn(),
    findOneBy: vi.fn(),
    save: vi.fn(),
  };
  const identity: IdentityPort = { getCurrentUserId: () => userId };
  const service = new TripsService(
    repository as unknown as Repository<TripEntity>,
    identity,
  );
  return { repository, service };
}

describe('TripsService', () => {
  it('rejects an end date before the start date', async () => {
    const { repository, service } = createService();

    await expect(
      service.create({
        title: '잘못된 여행',
        destination: '서울',
        timezone: 'Asia/Seoul',
        startDate: '2026-11-02',
        endDate: '2026-10-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('always scopes the active trip list to the current user', async () => {
    const { repository, service } = createService();
    repository.find.mockResolvedValue([]);

    await service.list();

    expect(repository.find).toHaveBeenCalledWith({
      where: { ownerId: userId, active: true, archivedAt: expect.any(Object) },
      order: { startDate: 'ASC' },
    });
  });
});
