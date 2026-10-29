import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports readiness only after the database responds', async () => {
    const query = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const controller = new HealthController({ query } as unknown as DataSource);

    await expect(controller.getHealth()).resolves.toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports unavailable when the database cannot be reached', async () => {
    const controller = new HealthController({
      query: vi.fn().mockRejectedValue(new Error('connection failed')),
    } as unknown as DataSource);

    await expect(controller.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
