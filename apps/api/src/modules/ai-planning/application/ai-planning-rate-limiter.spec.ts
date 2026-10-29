import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AiPlanningRateLimiter } from './ai-planning-rate-limiter';

describe('AiPlanningRateLimiter', () => {
  it('allows five requests per user in a rolling minute', () => {
    const limiter = new AiPlanningRateLimiter();
    for (let index = 0; index < 5; index += 1) limiter.assertAllowed('user-1', 1_000 + index);
    expect(() => limiter.assertAllowed('user-1', 2_000)).toThrow(HttpException);
    expect(() => limiter.assertAllowed('user-1', 62_000)).not.toThrow();
  });
});
