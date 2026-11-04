import { ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import type { IdentityPort } from '../../identity/domain/identity.port';
import { TripEntity } from '../../trips/domain/entities/trip.entity';
import { SubscriptionTier, UserEntity } from '../../users/domain/entities/user.entity';
import { EntitlementsService } from './entitlements.service';

function createService(tier = SubscriptionTier.Free, tripCount = 0, aiGenerations = 0) {
  const users = {
    findOneBy: vi.fn().mockResolvedValue({ subscriptionTier: tier, successfulAiGenerations: aiGenerations }),
    increment: vi.fn(),
  };
  const trips = { countBy: vi.fn().mockResolvedValue(tripCount) };
  const identity: IdentityPort = { getCurrentUserId: () => '00000000-0000-4000-8000-000000000001' };
  const service = new EntitlementsService(
    users as unknown as Repository<UserEntity>,
    trips as unknown as Repository<TripEntity>,
    identity,
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
});
