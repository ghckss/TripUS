import { describe, expect, it } from 'vitest';

import { AI_PLANNING_TASK, TRAVEL_STYLE_POLICIES, TravelStyle } from '../domain/ai-planner.port';
import { MockAiPlannerAdapter } from './mock-ai-planner.adapter';

describe('MockAiPlannerAdapter', () => {
  it('creates a deterministic plan that distributes all saved places across the trip', async () => {
    const planner = new MockAiPlannerAdapter();
    const places = Array.from({ length: 5 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `Place ${index}`,
      address: `Address ${index}`,
      latitude: 37.5 + index / 100,
      longitude: 127 + index / 100,
      tag: 'sight',
      preference: index === 4 ? 'must_visit' : 'want_to_visit',
      note: null,
    }));

    const result = await planner.generate({
      task: AI_PLANNING_TASK,
      trip: {
        title: 'Seoul trip',
        destination: 'Seoul',
        regions: [],
        timezone: 'Asia/Seoul',
        startDate: '2026-10-31',
        endDate: '2026-11-01',
        startPoint: null,
        endPoint: null,
      },
      style: TRAVEL_STYLE_POLICIES[TravelStyle.Relaxed],
      travelerContext: {
        companions: null,
        transportMode: null,
        budgetLevel: null,
        preferences: null,
        avoidances: null,
      },
      places,
      days: [],
      lockedPlacements: [],
      priorRecommendations: [],
    });

    expect(result.placements).toHaveLength(5);
    expect(result.placements[0]?.savedPlaceId).toBe(places[4]?.id);
    expect(result.placements[1]).toMatchObject({ date: '2026-11-01', position: 0 });
    expect(result.unplaced).toHaveLength(0);
  });
});
