import { describe, expect, it, vi } from 'vitest';

import type { IdentityPort } from '../../identity/domain/identity.port';
import { TelemetryController } from './telemetry.controller';

describe('TelemetryController', () => {
  it('accepts authenticated product events', () => {
    const getCurrentUserId = vi.fn(() => 'user-1');
    const identity: IdentityPort = { getCurrentUserId };
    const controller = new TelemetryController(identity);

    expect(controller.ingest({ events: [{ name: 'trip.created', occurredAt: new Date().toISOString(), properties: { source: 'mobile' } }] })).toBeUndefined();
    expect(getCurrentUserId).toHaveBeenCalledOnce();
  });
});
