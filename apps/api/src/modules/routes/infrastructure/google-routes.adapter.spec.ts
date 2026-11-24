import { describe, expect, it } from 'vitest';

import { representativeDepartureTime } from './google-routes.adapter';

describe('representativeDepartureTime', () => {
  it('keeps a future departure unchanged', () => {
    expect(representativeDepartureTime('2026-12-01T11:00:00.000Z', new Date('2026-11-24T00:00:00.000Z')))
      .toBe('2026-12-01T11:00:00.000Z');
  });

  it('moves a past departure to the next matching weekday and time', () => {
    expect(representativeDepartureTime('2026-11-01T02:00:00.000Z', new Date('2026-11-24T00:00:00.000Z')))
      .toBe('2026-11-29T02:00:00.000Z');
  });

  it('omits a departure when none was supplied', () => {
    expect(representativeDepartureTime()).toBeUndefined();
  });
});
