import { describe, expect, it, vi } from 'vitest';

import { UserEntity } from '../../users/domain/entities/user.entity';
import { RefreshTokenEntity } from '../domain/entities/refresh-token.entity';
import { AuthService } from './auth.service';

describe('AuthService refresh', () => {
  it('locks only the refresh token row before loading its user', async () => {
    const user = { id: '00000000-0000-4000-8000-000000000001', email: 'traveler@tripus.local', displayName: '여행자' };
    const token = { id: 'old-token', userId: user.id, revokedAt: null, replacedByTokenId: null };
    const refreshRepository = {
      create: vi.fn((input: Record<string, unknown>) => ({ ...input, id: 'next-token' })),
      save: vi.fn((input: object) => Promise.resolve(input)),
    };
    const manager = {
      findOne: vi.fn().mockResolvedValue(token),
      findOneBy: vi.fn().mockResolvedValue(user),
      getRepository: vi.fn().mockReturnValue(refreshRepository),
      save: vi.fn((_entity: unknown, input: object) => Promise.resolve(input)),
    };
    const dataSource = {
      transaction: vi.fn((callback: (transactionManager: typeof manager) => Promise<unknown>) => callback(manager)),
    };
    const config = {
      getOrThrow: vi.fn((key: string) => ({
        ACCESS_TOKEN_SECRET: 'tripus-test-secret-at-least-32-characters',
        ACCESS_TOKEN_ISSUER: 'tripus-api',
        ACCESS_TOKEN_AUDIENCE: 'tripus-mobile',
      })[key]),
    };
    const service = new AuthService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config as never,
      dataSource as never,
    );

    const session = await service.refresh({ refreshToken: 'raw-refresh-token' });

    expect(manager.findOne).toHaveBeenCalledWith(RefreshTokenEntity, expect.objectContaining({
      lock: { mode: 'pessimistic_write' },
    }));
    expect(manager.findOne.mock.calls[0]?.[1]).not.toHaveProperty('relations');
    expect(manager.findOneBy).toHaveBeenCalledWith(UserEntity, { id: user.id });
    expect(token.revokedAt).toBeInstanceOf(Date);
    expect(token.replacedByTokenId).toBe('next-token');
    expect(session.user.id).toBe(user.id);
  });
});
