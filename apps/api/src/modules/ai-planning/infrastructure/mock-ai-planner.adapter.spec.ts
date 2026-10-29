import { describe, expect, it } from 'vitest';

import { TravelStyle } from '../domain/ai-planner.port';
import { MockAiPlannerAdapter } from './mock-ai-planner.adapter';

describe('MockAiPlannerAdapter', () => {
  it('creates a deterministic relaxed plan and leaves overflow unplaced', async () => {
    const planner = new MockAiPlannerAdapter();
    const places = Array.from({ length: 5 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `Place ${index}`,
      tag: 'sight',
      preference: index === 4 ? 'must' : 'want',
      note: null,
    }));

    const result = await planner.generate({
      destination: 'Seoul',
      startDate: '2026-10-31',
      endDate: '2026-11-01',
      style: TravelStyle.Relaxed,
      places,
    });

    expect(result.placements).toHaveLength(4);
    expect(result.placements[0]?.savedPlaceId).toBe(places[4]?.id);
    expect(result.placements[2]).toMatchObject({ date: '2026-11-01', position: 0 });
    expect(result.unplaced).toHaveLength(1);
  });
});
