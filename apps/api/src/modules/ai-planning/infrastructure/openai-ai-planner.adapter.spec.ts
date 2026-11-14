import { describe, expect, it } from 'vitest';

import { createAiPlanSchema } from './openai-ai-planner.adapter';

const placement = {
  savedPlaceId: '30000000-0000-4000-8000-000000000001',
  date: '2026-11-08',
  position: 0,
  startTime: '09:00',
  durationMinutes: 120,
  activity: '장소 둘러보기',
  travelMethod: '도보',
  travelDurationMinutes: 10,
  preferredTimeSlot: 'any',
};

const recommendation = {
  placeName: '서울숲',
  regionName: '서울특별시',
  suggestedDate: '2026-11-08',
  position: 0,
  startTime: '09:00',
  durationMinutes: 120,
  activity: '서울숲 둘러보기',
  travelMethod: '대중교통',
  travelDurationMinutes: 20,
  reason: '서울의 대표적인 공원',
  preferredTimeSlot: 'daytime',
};

describe('createAiPlanSchema', () => {
  it('requires recommendation-only output when there are no saved places', () => {
    const schema = createAiPlanSchema([]);

    expect(schema.safeParse({ placements: [placement], unplaced: [], recommendations: [], savedRecommendations: [] }).success).toBe(false);
    expect(schema.safeParse({ placements: [], unplaced: [], recommendations: [recommendation], savedRecommendations: [] }).success).toBe(true);
  });

  it('rejects placement IDs that were not supplied by the service', () => {
    const allowedId = '30000000-0000-4000-8000-000000000002';
    const schema = createAiPlanSchema([allowedId]);

    expect(schema.safeParse({ placements: [placement], unplaced: [], recommendations: [], savedRecommendations: [] }).success).toBe(false);
    expect(schema.safeParse({
      placements: [{ ...placement, savedPlaceId: allowedId }],
      unplaced: [],
      recommendations: [],
      savedRecommendations: [{ placeName: '덕수궁', regionName: '서울', reason: '시간이 되면 추천' }],
    }).success).toBe(true);
  });
});
