import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { SubscriptionTier, UserEntity } from '../../users/domain/entities/user.entity';
import { EntitlementsService } from './entitlements.service';
import { BillingProvider } from '../../../config/environment';

function createService(tier = SubscriptionTier.Free, tripCount = 0, aiGenerations = 0, billing = BillingProvider.Mock) {
  let currentTier = tier;
  const users = {
    findOneBy: vi.fn().mockImplementation(() => Promise.resolve({ subscriptionTier: currentTier, successfulAiGenerations: aiGenerations })),
    increment: vi.fn(),
    update: vi.fn().mockImplementation(() => {
      currentTier = SubscriptionTier.Plus;
      return Promise.resolve({ affected: 1 });
    }),
  };
  const trips = { countBy: vi.fn().mockResolvedValue(tripCount) };
  const identity: IdentityPort = { getCurrentUserId: () => '00000000-0000-4000-8000-000000000001' };
  const config = { get: vi.fn().mockReturnValue(billing) };
  const service = new EntitlementsService(
    users as unknown as Repository<UserEntity>,
    trips as unknown as Repository<TripEntity>,
    identity,
    config as unknown as ConfigService,
  );
  return { service, users };
}

describe('EntitlementsService', () => {
  it('blocks a second free trip', async () => {
    const { service } = createService(SubscriptionTier.Free, 1);
    await expect(service.assertCanCreateTrip()).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks a second successful free AI generation', async () => {
    const { service } = createService(SubscriptionTier.Free, 1, 1);
    await expect(service.assertCanGenerateAiPlan()).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not apply numeric limits to Plus', async () => {
    const { service } = createService(SubscriptionTier.Plus, 12, 35);
    await expect(service.assertCanCreateTrip()).resolves.toBeUndefined();
    await expect(service.assertCanGenerateAiPlan()).resolves.toBeUndefined();
  });

  it('upgrades the authenticated user to Plus in mock billing mode', async () => {
    const { service, users } = createService();

    await expect(service.upgrade()).resolves.toMatchObject({
      tier: SubscriptionTier.Plus,
      tripLimit: null,
      aiGenerationLimit: null,
    });
    expect(users.update).toHaveBeenCalledWith(
      { id: '00000000-0000-4000-8000-000000000001' },
      { subscriptionTier: SubscriptionTier.Plus },
    );
  });

  it('keeps repeated upgrades idempotent', async () => {
    const { service, users } = createService(SubscriptionTier.Plus);

    await service.upgrade();

    expect(users.update).not.toHaveBeenCalled();
  });

  it('blocks upgrades unless mock billing is explicitly enabled', async () => {
    const { service } = createService(SubscriptionTier.Free, 0, 0, BillingProvider.Disabled);

    await expect(service.upgrade()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
