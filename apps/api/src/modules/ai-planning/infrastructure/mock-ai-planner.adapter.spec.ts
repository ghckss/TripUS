import { describe, expect, it } from 'vitest';

import { TravelTheme } from '../domain/ai-planner.port';
import { MockAiPlannerAdapter } from './mock-ai-planner.adapter';

const preferences = {
  themes: [TravelTheme.Highlights],
  companions: null,
  transportModes: ['public_transit'] as const,
  budgetLevel: 'standard' as const,
  additionalRequests: null,
};

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
      primaryType: 'tourist_attraction',
      regularOpeningHours: null,
    }));

    const result = await planner.generate({
      preferences: { ...preferences, transportModes: [...preferences.transportModes] },
      trip: {
        title: 'Seoul trip',
        destination: 'Seoul',
        regions: [],
        timezone: 'Asia/Seoul',
        startDate: '2026-10-31',
        endDate: '2026-11-01',
        lodgings: [],
        startPoint: null,
        endPoint: null,
      },
      places,
      days: [{ date: '2026-10-31', startLodging: null, endLodging: null }, { date: '2026-11-01', startLodging: null, endLodging: null }],
    });

    expect(result.days.flatMap((day) => day.visits)).toHaveLength(5);
    expect(result.days[0]?.visits[0]?.savedPlaceId).toBe(places[4]?.id);
    expect(result.days[1]).toMatchObject({ date: '2026-11-01', visits: [{ savedPlaceId: places[0]?.id }, { savedPlaceId: places[2]?.id }] });
  });

  it('only returns the requested day even when the trip spans multiple days', async () => {
    const input = {
      preferences: { ...preferences, transportModes: [...preferences.transportModes] },
      trip: { title: 'Paris', destination: 'France', regions: [], timezone: 'Europe/Paris', startDate: '2026-12-01', endDate: '2026-12-07', lodgings: [], startPoint: null, endPoint: null },
      places: [], days: [{ date: '2026-12-03', startLodging: null, endLodging: null }],
    };
    expect(await new MockAiPlannerAdapter().generate(input)).toEqual({ days: [{ date: '2026-12-03', visits: [] }] });
  });
  it('uses the requested day scope rather than expanding back to the full trip', async () => {
    const output = await new MockAiPlannerAdapter().generate({
      preferences: { ...preferences, transportModes: [...preferences.transportModes] },
      trip: { title: 'Paris', destination: 'France', regions: [], timezone: 'Europe/Paris', startDate: '2026-12-01', endDate: '2026-12-07', lodgings: [], startPoint: null, endPoint: null },
      places: [{ id: 'place', name: 'Museum', address: null, latitude: null, longitude: null, tag: 'attraction', preference: 'must_visit', note: null }],
      days: [{ date: '2026-12-03', startLodging: null, endLodging: null }],
    });
    expect(output.days).toHaveLength(1);
    expect(output.days[0]).toMatchObject({ date: '2026-12-03', visits: [{ savedPlaceId: 'place' }] });
  });

});
