import { BadRequestException } from '@nestjs/common';
import { IsNull, type Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../domain/entities/trip.entity';
import { TripsService } from './trips.service';
import type { EntitlementsService } from '../../entitlements/application/entitlements.service';

const userId = '00000000-0000-4000-8000-000000000001';

function createService() {
  const repository = {
    create: vi.fn((value: Partial<TripEntity>) => value as TripEntity),
    find: vi.fn(),
    findOneBy: vi.fn(),
    save: vi.fn(),
  };
  const identity: IdentityPort = { getCurrentUserId: () => userId };
  const entitlements = { assertCanCreateTrip: vi.fn() };
  const service = new TripsService(
    repository as unknown as Repository<TripEntity>,
    identity,
    entitlements as unknown as EntitlementsService,
  );
  return { entitlements, repository, service };
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
      where: { ownerId: userId, active: true, archivedAt: IsNull() },
      order: { startDate: 'ASC' },
    });
  });

  it('normalizes and stores multiple trip regions', async () => {
    const { repository, service } = createService();
    repository.save.mockImplementation((trip: unknown) => Promise.resolve(trip as TripEntity));

    const result = await service.create({
      title: '서울과 인제 여행',
      destination: '한국',
      regions: [
        { googlePlaceId: 'seoul', name: ' 서울 ', address: ' 대한민국 서울 ', latitude: 37.5665, longitude: 126.978 },
        { googlePlaceId: 'inje', name: '인제군', address: '강원특별자치도 인제군', latitude: 38.0695, longitude: 128.1707 },
      ],
      timezone: 'Asia/Seoul',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      regions: [
        { googlePlaceId: 'seoul', name: '서울', address: '대한민국 서울', latitude: 37.5665, longitude: 126.978 },
        { googlePlaceId: 'inje', name: '인제군', address: '강원특별자치도 인제군', latitude: 38.0695, longitude: 128.1707 },
      ],
    }));
    expect(result.regions).toHaveLength(2);
  });

  it('rejects duplicate trip regions', async () => {
    const { service } = createService();
    await expect(service.create({
      title: '중복 지역 여행',
      destination: '한국',
      regions: [
        { googlePlaceId: 'seoul', name: '서울', address: null, latitude: null, longitude: null },
        { googlePlaceId: 'seoul', name: '서울특별시', address: null, latitude: null, longitude: null },
      ],
      timezone: 'Asia/Seoul',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates the effective date range when updating a trip', async () => {
    const { repository, service } = createService();
    repository.findOneBy.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001',
      ownerId: userId,
      active: true,
      startDate: '2026-11-10',
      endDate: '2026-11-12',
    });

    await expect(service.update('10000000-0000-4000-8000-000000000001', { endDate: '2026-11-09' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('soft deletes only an owned active trip', async () => {
    const { repository, service } = createService();
    const trip = { id: '10000000-0000-4000-8000-000000000001', ownerId: userId, active: true } as TripEntity;
    repository.findOneBy.mockResolvedValue(trip);
    repository.save.mockResolvedValue(trip);

    await service.remove(trip.id);

    expect(trip.active).toBe(false);
    expect(repository.save).toHaveBeenCalledWith(trip);
  });
});
