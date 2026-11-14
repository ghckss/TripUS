import { describe, expect, it } from 'vitest';

import { createAiPlanSchema, PlannerReviewSchema } from './openai-ai-planner.adapter';

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

    expect(schema.safeParse({ placements: [placement], unplaced: [], placeDescriptions: [], recommendations: [], savedRecommendations: [] }).success).toBe(false);
    expect(schema.safeParse({ placements: [], unplaced: [], placeDescriptions: [], recommendations: [recommendation], savedRecommendations: [] }).success).toBe(true);
  });

  it('rejects placement IDs that were not supplied by the service', () => {
    const allowedId = '30000000-0000-4000-8000-000000000002';
    const schema = createAiPlanSchema([allowedId]);

    expect(schema.safeParse({ placements: [placement], unplaced: [], placeDescriptions: [], recommendations: [], savedRecommendations: [] }).success).toBe(false);
    expect(schema.safeParse({
      placements: [{ ...placement, savedPlaceId: allowedId }],
      unplaced: [],
      placeDescriptions: [{ savedPlaceId: allowedId, description: '서울의 역사를 볼 수 있는 대표 궁궐' }],
      recommendations: [],
      savedRecommendations: [{ placeName: '덕수궁', regionName: '서울', reason: '시간이 되면 추천' }],
    }).success).toBe(true);
  });

  it('only accepts descriptions for supplied places that are missing a note', () => {
    const allowedId = '30000000-0000-4000-8000-000000000002';
    const describedId = '30000000-0000-4000-8000-000000000003';
    const schema = createAiPlanSchema([allowedId, describedId], [allowedId]);

    expect(schema.safeParse({
      placements: [], unplaced: [], recommendations: [], savedRecommendations: [],
      placeDescriptions: [{ savedPlaceId: describedId, description: '기존 설명을 덮어쓰면 안 됨' }],
    }).success).toBe(false);
  });
});

describe('PlannerReviewSchema', () => {
  it('accepts a compact specialist review and rejects incomplete issues', () => {
    expect(PlannerReviewSchema.safeParse({
      verdict: 'revise',
      summary: '야경 명소 시간대 조정이 필요함',
      issues: [{
        severity: 'blocking',
        code: 'night_view_in_morning',
        date: '2026-11-08',
        placeNames: ['타이베이 101'],
        finding: '야경 명소가 오전에 배치됨',
        requiredChange: '일몰 이후로 이동하고 주변 일정을 재배치',
      }],
    }).success).toBe(true);
    expect(PlannerReviewSchema.safeParse({ verdict: 'revise', summary: '문제 있음', issues: [{ code: 'missing_fields' }] }).success).toBe(false);
  });
});
