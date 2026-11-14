import { describe, expect, it, vi } from 'vitest';

import { PlaceTag, type SavedPlaceEntity } from '../../places/domain/entities/saved-place.entity';
import { PlacePreference } from '../../places/domain/entities/saved-place.entity';
import { ItineraryUpdateStatus } from '../../itineraries/application/dto/itinerary.dto';
import {
  AI_PLANNING_TASK,
  type AiPlannerInput,
  type AiPlannerOutput,
  type AiPlannerReview,
  type AiPlannerReviewFocus,
  TRAVEL_DENSITY_POLICIES,
  TravelDensity,
  TravelTheme,
} from '../domain/ai-planner.port';
import { AiPlanGenerationStatus, AiTransportMode } from './dto/generate-ai-plan.dto';
import {
  addLodgingEndpoints,
  allowsMultipleOptionalStops,
  applyDailyPlanningTargets,
  applyOpeningHoursPreferences,
  applyVisitTimePreferences,
  assessExplicitRequestCoverage,
  assessOpeningHours,
  assessPlanQuality,
  assessRawOutputContract,
  assessRawDayCoverage,
  assessTimeSuitability,
  AiPlanningService,
  buildPlannerDays,
  enumerateTripDates,
  extractRequiredActivityRequests,
  findReusableAiRecommendation,
  findTravelerDuplicatePlaceIds,
  isRecommendableCandidate,
  isBlockingQualityIssue,
  isWithinSelectedRegions,
  normalizeGeneratedPlacements,
  normalizeVisitSchedule,
  optionalStopCategory,
  requiredMealSlots,
  shouldRejectAiPlaceDuplicate,
} from './ai-planning.service';

describe('AI final review orchestration', () => {
  const draft: Omit<AiPlannerOutput, 'usage'> = {
    placements: [],
    unplaced: [],
    placeDescriptions: [],
    recommendations: [],
    savedRecommendations: [],
  };

  function createService(planner: object) {
    return new AiPlanningService(
      {} as never, {} as never, planner as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never,
    );
  }

  it('runs three specialist reviews and gives every result to the integrator', async () => {
    const reviewedFocuses: AiPlannerReviewFocus[] = [];
    const review = vi.fn((_input: AiPlannerInput, _draft: Omit<AiPlannerOutput, 'usage'>, focus: AiPlannerReviewFocus): Promise<AiPlannerReview> => {
      reviewedFocuses.push(focus);
      return Promise.resolve({ focus, verdict: 'pass', summary: `${focus} 검토 완료`, issues: [] });
    });
    const integrated: AiPlannerOutput = { ...draft, usage: { inputTokens: 100, outputTokens: 50 } };
    let integrationInput: AiPlannerInput | undefined;
    const generate = vi.fn((input: AiPlannerInput): Promise<AiPlannerOutput> => {
      integrationInput = input;
      return Promise.resolve(integrated);
    });
    const service = createService({ review, generate });

    const result = await (service as unknown as {
      runOrchestratedFinalReview(
        generationId: string,
        tripId: string,
        input: AiPlannerInput,
        reviewDraft: Omit<AiPlannerOutput, 'usage'>,
      ): Promise<AiPlannerOutput>;
    }).runOrchestratedFinalReview('generation-1', 'trip-1', {} as AiPlannerInput, draft);

    expect(review).toHaveBeenCalledTimes(3);
    expect(reviewedFocuses).toEqual(['route_time', 'traveler_intent', 'meal_density']);
    expect(integrationInput?.orchestrationReviews?.map((item) => item.focus)).toEqual(['route_time', 'traveler_intent', 'meal_density']);
    expect(integrationInput?.revisionDraft).toBe(draft);
    expect(result).toBe(integrated);
  });

  it('keeps the verified draft when specialist or integration calls fail', async () => {
    const review = vi.fn((_input: AiPlannerInput, _draft: Omit<AiPlannerOutput, 'usage'>, focus: AiPlannerReviewFocus): Promise<AiPlannerReview> => {
      if (focus === 'route_time') return Promise.reject(new Error('review unavailable'));
      return Promise.resolve({ focus, verdict: 'pass', summary: '검토 완료', issues: [] });
    });
    let integrationInput: AiPlannerInput | undefined;
    const generate = vi.fn((input: AiPlannerInput): Promise<AiPlannerOutput> => {
      integrationInput = input;
      return Promise.reject(new Error('integration unavailable'));
    });
    const service = createService({ review, generate });

    const result = await (service as unknown as {
      runOrchestratedFinalReview(
        generationId: string,
        tripId: string,
        input: AiPlannerInput,
        reviewDraft: Omit<AiPlannerOutput, 'usage'>,
      ): Promise<AiPlannerOutput>;
    }).runOrchestratedFinalReview('generation-2', 'trip-2', {} as AiPlannerInput, draft);

    expect(integrationInput?.orchestrationReviews?.map((item) => item.focus)).toEqual(['traveler_intent', 'meal_density']);
    expect(result).toEqual(draft);
  });
});

describe('AI plan quality severity', () => {
  it('returns the best verified schedule for degradable quality issues after internal repair attempts', () => {
    expect(isBlockingQualityIssue('underfilled_day:2026-11-08')).toBe(false);
    expect(isBlockingQualityIssue('time_slot_mismatch:2026-11-08:observatory')).toBe(false);
    expect(isBlockingQualityIssue('closed_place:2026-11-08:museum')).toBe(false);
    expect(isBlockingQualityIssue('long_travel_leg:2026-11-08')).toBe(true);
    expect(isBlockingQualityIssue('saved_places_missing')).toBe(true);
    expect(isBlockingQualityIssue('schedule_detail_missing:2026-11-08')).toBe(true);
    expect(isBlockingQualityIssue('outside_available_window:2026-11-08')).toBe(true);
    expect(isBlockingQualityIssue('missing_meal:2026-11-08:lunch')).toBe(false);
  });

  it('blocks both sparse schedules and invalid time windows after repair attempts', () => {
    const issues = assessPlanQuality({
      days: [{
        date: '2026-11-08', startLodging: null, endLodging: null,
        availableStartTime: '15:00', availableEndTime: '21:00', targetPlannedMinutes: 300,
      }],
      density: TravelDensity.Balanced,
      planningPlaces: [],
      generated: [],
      recommended: [{
        savedPlaceId: 'recommended-1', date: '2026-11-08', position: 0,
        scheduledTime: '14:30', durationMinutes: 90, activitySummary: '식사',
        travelMethod: '대중교통', travelDurationMinutes: 45,
      }],
      locked: [],
      placeTagsById: new Map([['recommended-1', PlaceTag.Attraction]]),
      output: { placements: [], unplaced: [], recommendations: [] },
    });

    expect(issues).toEqual(expect.arrayContaining([
      'underfilled_day:2026-11-08',
      'outside_available_window:2026-11-08',
    ]));
    expect(issues.filter(isBlockingQualityIssue)).toEqual(['outside_available_window:2026-11-08']);
  });

  it('does not count cafes as a required lunch', () => {
    const visits = [
      { savedPlaceId: 'breakfast', scheduledTime: '09:00' },
      { savedPlaceId: 'cafe', scheduledTime: '12:30' },
      { savedPlaceId: 'dinner', scheduledTime: '18:30' },
    ].map((visit, position) => ({
      ...visit, date: '2026-11-08', position, durationMinutes: 120,
      activitySummary: '방문', travelMethod: '도보', travelDurationMinutes: 30,
    }));
    const issues = assessPlanQuality({
      days: [{
        date: '2026-11-08', startLodging: null, endLodging: null,
        availableStartTime: '09:00', availableEndTime: '21:00', targetPlannedMinutes: 450,
      }],
      density: TravelDensity.Balanced,
      planningPlaces: [], generated: visits, recommended: [], locked: [],
      placeTagsById: new Map([
        ['breakfast', PlaceTag.Food], ['cafe', PlaceTag.Cafe], ['dinner', PlaceTag.Food],
      ]),
      output: { placements: [], unplaced: [], recommendations: [] },
    });

    expect(issues).toContain('missing_meal:2026-11-08:lunch');
    expect(issues).not.toContain('missing_meal:2026-11-08:breakfast');
    expect(issues).not.toContain('missing_meal:2026-11-08:dinner');
  });

  it('applies first-day, middle-day, and last-day meal rules', () => {
    const fullDay = { date: '2026-11-08', startLodging: null, endLodging: null, availableStartTime: '09:00', availableEndTime: '21:00' };
    expect(requiredMealSlots({ ...fullDay, isFirstDay: true, isLastDay: false }, 0, 3)).toEqual(['lunch', 'dinner']);
    expect(requiredMealSlots({ ...fullDay, isFirstDay: false, isLastDay: false }, 1, 3)).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(requiredMealSlots({ ...fullDay, isFirstDay: false, isLastDay: true }, 2, 3)).toEqual(['breakfast', 'lunch']);
    expect(requiredMealSlots({ ...fullDay, isFirstDay: true, isLastDay: true }, 0, 1)).toEqual(['lunch']);
  });

  it('skips lunch after a late first-day start or before an early last-day end', () => {
    const day = { date: '2026-11-08', startLodging: null, endLodging: null };
    expect(requiredMealSlots({ ...day, isFirstDay: true, availableStartTime: '14:01', availableEndTime: '21:00' }, 0, 2)).toEqual(['dinner']);
    expect(requiredMealSlots({ ...day, isLastDay: true, availableStartTime: '09:00', availableEndTime: '11:59' }, 1, 2)).toEqual(['breakfast']);
  });
});

describe('explicit activity request coverage', () => {
  it('extracts a named tour as a mandatory activity while leaving general preferences soft', () => {
    expect(extractRequiredActivityRequests('하루는 예스허지 버스투어 예정. 현지 맛집을 좋아해요.')).toEqual([
      { name: '예스허지 버스투어', sourceText: '하루는 예스허지 버스투어 예정', fullDay: true, minimumStops: 2 },
    ]);
    expect(extractRequiredActivityRequests('버스투어는 피하고 싶어요')).toEqual([]);
  });

  it('requires the named tour to be present in an itinerary visit', () => {
    const request = { name: '예스허지 버스투어', sourceText: '하루는 예스허지 버스투어 예정', fullDay: true, minimumStops: 2 };
    const missing = assessExplicitRequestCoverage([request], {
      placements: [], unplaced: [], recommendations: [{
        placeName: '예류지질공원', regionName: '신베이', suggestedDate: '2026-11-08', position: 0,
        startTime: '09:00', durationMinutes: 90, activity: '해안 지형 관람', travelMethod: '버스',
        travelDurationMinutes: 50, reason: '대표 명소',
      }],
    });
    const covered = assessExplicitRequestCoverage([request], {
      placements: [], unplaced: [], recommendations: [{
        placeName: '예류지질공원', regionName: '신베이', suggestedDate: '2026-11-08', position: 0,
        startTime: '09:00', durationMinutes: 180, activity: '예스허지 버스투어 첫 코스', travelMethod: '버스',
        travelDurationMinutes: 50, reason: '사용자 요청 투어',
      }, {
        placeName: '지우펀', regionName: '신베이', suggestedDate: '2026-11-08', position: 1,
        startTime: '13:00', durationMinutes: 180, activity: '예스허지 버스투어 마지막 코스', travelMethod: '버스',
        travelDurationMinutes: 50, reason: '사용자 요청 투어',
      }],
    });

    expect(missing).toEqual(['required_activity_missing:0']);
    expect(covered).toEqual([]);
  });
});

describe('daily planning targets', () => {
  const days = [
    { date: '2026-11-08', startLodging: null, endLodging: null },
    { date: '2026-11-09', startLodging: null, endLodging: null },
  ];

  it('reduces the first and last day targets around arrival and departure times', () => {
    expect(applyDailyPlanningTargets(days, TravelDensity.Balanced, '15:30', '12:00')).toEqual([
      expect.objectContaining({
        date: '2026-11-08', availableStartTime: '15:30', availableEndTime: '21:00', targetPlannedMinutes: 225,
      }),
      expect.objectContaining({
        date: '2026-11-09', availableStartTime: '09:00', availableEndTime: '12:00', targetPlannedMinutes: 90,
      }),
    ]);
  });

  it('keeps the style target for full days', () => {
    expect(applyDailyPlanningTargets(days, TravelDensity.Busy, null, null)).toEqual([
      expect.objectContaining({ targetPlannedMinutes: 480 }),
      expect.objectContaining({ targetPlannedMinutes: 480 }),
    ]);
  });

  it('preserves requested times and durations instead of hiding an impossible schedule through compression', () => {
    const normalized = normalizeVisitSchedule([
      { savedPlaceId: 'place-1', date: '2026-11-08', position: 0, scheduledTime: '16:00', durationMinutes: 300, travelDurationMinutes: 30 },
      { savedPlaceId: 'place-2', date: '2026-11-08', position: 1, scheduledTime: '20:00', durationMinutes: 300, travelDurationMinutes: 30 },
    ], [{
      date: '2026-11-08', startLodging: null, endLodging: null,
      availableStartTime: '15:00', availableEndTime: '21:00',
    }], new Set(['place-1', 'place-2']));

    expect(normalized[0]?.scheduledTime).toBe('16:00');
    expect(normalized[0]?.durationMinutes).toBe(300);
    const last = normalized[1]!;
    expect(last.scheduledTime).toBe('21:30');
    expect(last.durationMinutes).toBe(300);
  });
});

describe('time-aware itinerary optimization', () => {
  it('moves an observation deck into the evening without shortening its visit', () => {
    const preferred = applyVisitTimePreferences([{
      savedPlaceId: 'taipei-101', date: '2026-11-05', position: 0,
      scheduledTime: '09:35', durationMinutes: 90, travelDurationMinutes: 20,
      activitySummary: '타이베이101 전망대 방문',
    }], new Map([['taipei-101', { name: '타이베이101 전망대', tag: PlaceTag.Attraction }]]), []);
    const normalized = normalizeVisitSchedule(preferred, [{
      date: '2026-11-05', startLodging: null, endLodging: null,
      availableStartTime: '09:00', availableEndTime: '21:00',
    }], new Set(['taipei-101']));

    expect(normalized[0]).toMatchObject({ scheduledTime: '17:00', durationMinutes: 90, preferredTimeSlot: 'evening' });
    expect(assessTimeSuitability(normalized)).toEqual([]);
  });

  it('resets an AI-provided time that is later than the preferred slot', () => {
    const preferred = applyVisitTimePreferences([{
      savedPlaceId: 'breakfast', date: '2026-11-05', position: 0,
      scheduledTime: '18:00', durationMinutes: 60, travelDurationMinutes: 10,
      activitySummary: '현지 아침 식사',
    }], new Map([['breakfast', { name: '아침 전문점', tag: PlaceTag.Food }]]), []);

    expect(preferred[0]).toMatchObject({ scheduledTime: '07:00', preferredTimeSlot: 'morning' });
  });

  it('moves a visit into verified opening hours inside its preferred slot', () => {
    const adjusted = applyOpeningHoursPreferences([{
      savedPlaceId: 'museum', date: '2026-11-05', position: 0,
      scheduledTime: '08:00', durationMinutes: 60, preferredTimeSlot: 'daytime',
    }], new Map([['museum', {
      primaryType: 'museum', utcOffsetMinutes: 480,
      regularOpeningHours: {
        periods: [{ open: { day: 4, hour: 10, minute: 0 }, close: { day: 4, hour: 18, minute: 0 } }],
        weekdayDescriptions: [],
      },
    }]]));

    expect(adjusted[0]?.scheduledTime).toBe('10:00');
    expect(assessOpeningHours(adjusted, new Map([['museum', {
      primaryType: 'museum', utcOffsetMinutes: 480,
      regularOpeningHours: {
        periods: [{ open: { day: 4, hour: 10, minute: 0 }, close: { day: 4, hour: 18, minute: 0 } }],
        weekdayDescriptions: [],
      },
    }]]))).toEqual([]);
  });

  it('detects visits outside verified regular opening hours', () => {
    const issues = assessOpeningHours([{
      savedPlaceId: 'museum', date: '2026-11-05', position: 0,
      scheduledTime: '18:00', durationMinutes: 60,
    }], new Map([['museum', {
      primaryType: 'museum', utcOffsetMinutes: 480,
      regularOpeningHours: {
        periods: [{ open: { day: 4, hour: 9, minute: 0 }, close: { day: 4, hour: 17, minute: 0 } }],
        weekdayDescriptions: [],
      },
    }]]));

    expect(issues).toEqual(['closed_place:2026-11-05:museum']);
  });
});

describe('raw AI output validation', () => {
  it('does not count invented placement IDs toward daily coverage', () => {
    const output = {
      placements: [{
        savedPlaceId: '30000000-0000-4000-8000-000000000099', date: '2026-11-08', position: 0,
        startTime: '09:00', durationMinutes: 600, activity: '임의 장소', travelMethod: '도보', travelDurationMinutes: 30,
      }],
      unplaced: [],
      recommendations: [],
    };
    const allowedPlaceIds = new Set<string>();

    expect(assessRawOutputContract(allowedPlaceIds, output)).toEqual([
      'unknown_placement_ids',
      'recommendations_required',
    ]);
    expect(assessRawDayCoverage([{
      date: '2026-11-08', startLodging: null, endLodging: null,
    }], output, TravelDensity.Relaxed, allowedPlaceIds)).toEqual(['2026-11-08']);
  });

  it('requires every saved place to be scheduled rather than silently omitted or unplaced', () => {
    const allowedPlaceIds = new Set(['place-1', 'place-2']);

    expect(assessRawOutputContract(allowedPlaceIds, {
      placements: [{ savedPlaceId: 'place-1', date: '2026-11-08', position: 0 }],
      unplaced: [],
      recommendations: [],
    })).toContain('saved_places_missing');
    expect(assessRawOutputContract(allowedPlaceIds, {
      placements: [{ savedPlaceId: 'place-1', date: '2026-11-08', position: 0 }],
      unplaced: [{ savedPlaceId: 'place-2', reason: '다른 도시' }],
      recommendations: [],
    })).toContain('saved_places_unplaced');
  });
});

describe('previous AI recommendations', () => {
  it('reuses a previous AI place when it is recommended again', () => {
    const previous = {
      googlePlaceId: 'google-palace',
      name: '경복궁',
      note: 'AI 추천 · 도심 핵심 명소',
    };
    expect(findReusableAiRecommendation([previous], {
      googlePlaceId: 'google-palace',
      name: 'Gyeongbokgung Palace',
    })).toBe(previous);
  });

  it('does not reuse a traveler-saved place as an AI recommendation', () => {
    expect(findReusableAiRecommendation([{
      googlePlaceId: 'google-palace',
      name: '경복궁',
      note: null,
    }], {
      googlePlaceId: 'google-palace',
      name: '경복궁',
    })).toBeUndefined();
  });
});

describe('AI recommendation local relevance', () => {
  it('rejects an unrequested foreign-themed bar but allows it when explicitly requested', () => {
    const koreanBar = { name: '韓国バーヘブン', primaryType: 'bar' };

    expect(isRecommendableCandidate(koreanBar, '일본', '늦은 밤 술집 바 방문')).toBe(false);
    expect(isRecommendableCandidate(koreanBar, '일본', '한국식 술집을 방문하고 싶어요')).toBe(true);
  });

  it('keeps destination-local hospitality recommendations', () => {
    expect(isRecommendableCandidate({ name: '도톤보리 이자카야', primaryType: 'bar' }, '일본', '')).toBe(true);
  });
});

describe('AI recommendation diversity', () => {
  it('preserves traveler-selected duplicate places but not duplicated AI recommendations', () => {
    const travelerPlaceId = 'traveler-place';
    const aiPlaceId = 'ai-place';
    const duplicates = findTravelerDuplicatePlaceIds([
      { savedPlaceId: travelerPlaceId }, { savedPlaceId: travelerPlaceId },
      { savedPlaceId: aiPlaceId }, { savedPlaceId: aiPlaceId },
    ], new Map([
      [travelerPlaceId, { note: null }],
      [aiPlaceId, { note: 'AI 추천 · 일정 보완' }],
    ]));

    expect([...duplicates]).toEqual([travelerPlaceId]);
  });

  it('rejects an AI place already used on another date unless repeat visits were explicitly requested', () => {
    expect(shouldRejectAiPlaceDuplicate(true, false, '감성 카페와 사진 명소')).toBe(true);
    expect(shouldRejectAiPlaceDuplicate(true, false, '마루후쿠 커피를 1일차에도 넣어줘')).toBe(false);
  });

  it('treats cafes, desserts, and tea houses as separate optional-stop categories', () => {
    expect(optionalStopCategory({ name: 'CORA COFFEE', primaryType: 'cafe' })).toBe('cafe');
    expect(optionalStopCategory({ name: '말차 디저트 전문점', primaryType: 'dessert_shop' })).toBe('dessert');
    expect(optionalStopCategory({ name: '교토 티하우스', primaryType: 'tea_house' })).toBe('tea');
  });

  it('allows multiple cafes only for an explicit multi-stop request', () => {
    expect(allowsMultipleOptionalStops('감성 카페를 좋아해요', 'cafe')).toBe(false);
    expect(allowsMultipleOptionalStops('카페 투어를 하고 싶어요', 'cafe')).toBe(true);
    expect(allowsMultipleOptionalStops('카페 투어를 하고 싶어요', 'dessert')).toBe(false);
  });

  it('enforces other-day duplicates and per-category limits while materializing recommendations', async () => {
    const existingAiCafe = {
      id: 'existing-ai-cafe', googlePlaceId: 'google-existing', name: '기존 카페', note: 'AI 추천 · 기존 일정',
    };
    let savedIndex = 0;
    const candidates = new Map([
      ['기존 카페', { googlePlaceId: 'google-existing', name: '기존 카페', address: '오사카', primaryType: 'cafe', latitude: 34.6, longitude: 135.5 }],
      ['새 카페', { googlePlaceId: 'google-cafe-1', name: '새 카페', address: '오사카', primaryType: 'cafe', latitude: 34.6, longitude: 135.5 }],
      ['두번째 카페', { googlePlaceId: 'google-cafe-2', name: '두번째 카페', address: '오사카', primaryType: 'coffee_shop', latitude: 34.6, longitude: 135.5 }],
      ['디저트 가게', { googlePlaceId: 'google-dessert', name: '디저트 가게', address: '오사카', primaryType: 'dessert_shop', latitude: 34.6, longitude: 135.5 }],
    ]);
    const service = new AiPlanningService(
      {} as never,
      {
        create: vi.fn((input: Record<string, unknown>) => input),
        save: vi.fn((input: Record<string, unknown>) => Promise.resolve({ ...input, id: `new-${savedIndex++}` })),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { search: vi.fn((query: string) => Promise.resolve([candidates.get(query)])), getCoordinates: vi.fn() } as never,
      {} as never,
    );
    const materializer = service as unknown as {
      materializeRecommendations: (...args: unknown[]) => Promise<{
        placements: Array<{ savedPlaceId: string }>;
        rejected: Array<{ placeName: string; reason: string }>;
      }>;
    };
    const recommendation = (placeName: string, position: number) => ({
      placeName, regionName: '오사카', suggestedDate: '2026-11-18', position,
      startTime: `${10 + position}:00`, durationMinutes: 60, activity: '방문',
      travelMethod: '도보', travelDurationMinutes: 10, reason: '추천',
    });

    const result = await materializer.materializeRecommendations(
      'trip-1', '일본', [],
      ['기존 카페', '새 카페', '두번째 카페', '디저트 가게'].map(recommendation),
      [existingAiCafe], new Set(['2026-11-18']), '', new Set([existingAiCafe.id]), new Map(),
    );

    expect(result.placements).toHaveLength(2);
    expect(result.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ placeName: '기존 카페', reason: 'duplicate_ai_place' }),
      expect.objectContaining({ placeName: '두번째 카페', reason: 'duplicate_cafe' }),
    ]));
  });
});

describe('addLodgingEndpoints', () => {
  it('wraps each trip day with its own start and end lodging', () => {
    const result = addLodgingEndpoints([
      { savedPlaceId: 'place-1', date: '2026-11-08', position: 0, locked: false },
    ], [
      {
        date: '2026-11-08',
        startLodging: { savedPlaceId: 'lodging-1', name: 'First hotel', address: null, latitude: null, longitude: null },
        endLodging: { savedPlaceId: 'lodging-2', name: 'Second hotel', address: null, latitude: null, longitude: null },
      },
      {
        date: '2026-11-09',
        startLodging: { savedPlaceId: 'lodging-2', name: 'Second hotel', address: null, latitude: null, longitude: null },
        endLodging: null,
      },
    ]);

    expect(result).toEqual([
      { savedPlaceId: 'lodging-1', date: '2026-11-08', position: 0, locked: false },
      { savedPlaceId: 'place-1', date: '2026-11-08', position: 1, locked: false },
      { savedPlaceId: 'lodging-2', date: '2026-11-08', position: 2, locked: false },
      { savedPlaceId: 'lodging-2', date: '2026-11-09', position: 0, locked: false },
    ]);
  });
});

describe('buildPlannerDays', () => {
  const primary = {
    id: 'lodging-primary', name: 'Primary hotel', address: 'Seoul', latitude: 37.5, longitude: 127,
    tag: PlaceTag.Lodging, isPrimaryLodging: true,
  };
  const secondary = {
    id: 'lodging-secondary', name: 'Secondary hotel', address: 'Inje', latitude: 38, longitude: 128,
    tag: PlaceTag.Lodging, isPrimaryLodging: false,
  };
  const visit = {
    id: 'place-1', name: 'A place', address: 'Seoul', latitude: 37.51, longitude: 127.01,
    tag: PlaceTag.Attraction, isPrimaryLodging: false,
  };

  it('preserves lodging boundaries already selected for a day', () => {
    const result = buildPlannerDays(
      ['2026-11-07', '2026-11-08', '2026-11-09'],
      [
        { savedPlaceId: secondary.id, date: '2026-11-08', position: 0 },
        { savedPlaceId: visit.id, date: '2026-11-08', position: 1 },
        { savedPlaceId: primary.id, date: '2026-11-08', position: 2 },
      ],
      [primary, secondary, visit],
      primary,
    );

    expect(result[1]?.startLodging?.savedPlaceId).toBe(secondary.id);
    expect(result[1]?.endLodging?.savedPlaceId).toBe(primary.id);
    expect(result[1]?.startLodging).toMatchObject({ address: 'Inje', latitude: 38, longitude: 128 });
  });

  it('omits the first start and final end lodging while retaining overnight boundaries', () => {
    const result = buildPlannerDays(
      ['2026-11-08', '2026-11-09', '2026-11-10'],
      [{ savedPlaceId: visit.id, date: '2026-11-08', position: 0 }],
      [primary, visit],
      primary,
    );
    expect(result[0]?.startLodging).toBeNull();
    expect(result[0]?.endLodging?.savedPlaceId).toBe(primary.id);
    expect(result[1]?.startLodging?.savedPlaceId).toBe(primary.id);
    expect(result[1]?.endLodging?.savedPlaceId).toBe(primary.id);
    expect(result[2]?.startLodging?.savedPlaceId).toBe(primary.id);
    expect(result[2]?.endLodging).toBeNull();
  });
});

describe('enumerateTripDates', () => {
  it('builds every itinerary date directly from the trip date range', () => {
    expect(enumerateTripDates('2026-11-08', '2026-11-10')).toEqual([
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
    ]);
  });
});

describe('normalizeGeneratedPlacements', () => {
  it('removes unknown IDs, invalid dates, and duplicate placements', () => {
    const result = normalizeGeneratedPlacements([
      { savedPlaceId: 'place-1', date: '2026-11-08', position: 0 },
      { savedPlaceId: 'place-1', date: '2026-11-09', position: 0 },
      { savedPlaceId: 'unknown', date: '2026-11-08', position: 1 },
      { savedPlaceId: 'place-2', date: '2026-12-01', position: 0 },
    ], new Set(['place-1', 'place-2']), new Set(['2026-11-08', '2026-11-09']));

    expect(result).toEqual([{ savedPlaceId: 'place-1', date: '2026-11-08', position: 0 }]);
  });
});

describe('isWithinSelectedRegions', () => {
  it('accepts recommendations inside a selected city and rejects other cities', () => {
    const selectedRegions = [{ name: '서울' }];

    expect(isWithinSelectedRegions('서울 종로구', { name: '경복궁', address: '대한민국 서울특별시 종로구' }, selectedRegions)).toBe(true);
    expect(isWithinSelectedRegions('춘천', { name: '남이섬', address: '대한민국 강원특별자치도 춘천시' }, selectedRegions)).toBe(false);
    expect(isWithinSelectedRegions('서울', { name: '남이섬', address: '대한민국 강원특별자치도 춘천시' }, selectedRegions)).toBe(false);
  });

  it('uses selected-region coordinates when localized address names do not match', () => {
    expect(isWithinSelectedRegions(
      'Seoul',
      { name: '경복궁', address: 'Jongno-gu, Republic of Korea', latitude: 37.5796, longitude: 126.977 },
      [{ name: '서울특별시', latitude: 37.5665, longitude: 126.978 }],
    )).toBe(true);
    expect(isWithinSelectedRegions(
      'Busan',
      { name: '해운대해수욕장', address: 'Haeundae-gu, Republic of Korea', latitude: 35.1587, longitude: 129.1604 },
      [{ name: '서울특별시', latitude: 37.5665, longitude: 126.978 }],
    )).toBe(false);
  });
});

describe('AiPlanningService', () => {
  it('loads the latest AI request only from the current user trip', async () => {
    const tripId = '10000000-0000-4000-8000-000000000020';
    const latestAiPlanRequest = {
      style: 'food',
      companions: '친구 2명',
      transportMode: 'mixed',
      budgetLevel: 'standard',
      preferences: '현지 맛집',
      avoidances: '긴 대기',
    };
    const findOneBy = vi.fn().mockResolvedValue({ id: tripId, latestAiPlanRequest });
    const service = new AiPlanningService(
      { findOneBy } as never,
      {} as never,
      {} as never,
      {} as never,
      { getCurrentUserId: vi.fn().mockReturnValue('user-1') },
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getLatestRequest(tripId)).resolves.toEqual({ request: {
      density: TravelDensity.Balanced,
      themes: [TravelTheme.Food],
      companions: '친구 2명',
      transportModes: [AiTransportMode.PublicTransit, AiTransportMode.Walking],
      budgetLevel: 'standard',
      additionalRequests: '좋아하는 것: 현지 맛집\n피하고 싶은 것: 긴 대기',
    } });
    expect(findOneBy).toHaveBeenCalledWith({ id: tripId, ownerId: 'user-1', active: true });
  });

  it('rechecks an other-tagged place and persists it as food when Google identifies a restaurant', async () => {
    const place = {
      id: '20000000-0000-4000-8000-000000000099',
      googlePlaceId: 'google-restaurant',
      tag: PlaceTag.Other,
    } as SavedPlaceEntity;
    const save = vi.fn().mockResolvedValue(place);
    const getPrimaryType = vi.fn().mockResolvedValue('japanese_restaurant');
    const service = new AiPlanningService(
      {} as never,
      { save } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { search: vi.fn(), getCoordinates: vi.fn(), getPhoto: vi.fn(), getPrimaryType },
      {} as never,
    );

    const tags = await (service as unknown as {
      resolveActualPlaceTags(places: SavedPlaceEntity[], relevantIds: Set<string>): Promise<Map<string, PlaceTag>>;
    }).resolveActualPlaceTags([place], new Set([place.id]));

    expect(tags.get(place.id)).toBe(PlaceTag.Food);
    expect(place.tag).toBe(PlaceTag.Food);
    expect(getPrimaryType).toHaveBeenCalledWith('google-restaurant');
    expect(save).toHaveBeenCalledWith(place);
  });

  it('supplements only a missing meal without regenerating the AI itinerary', async () => {
    const tripId = '10000000-0000-4000-8000-000000000030';
    const mealId = '30000000-0000-4000-8000-000000000030';
    const visits = ['궁궐', '박물관', '야경 명소'].map((name, index) => ({
      id: `20000000-0000-4000-8000-00000000003${index}`,
      tripId,
      googlePlaceId: `google-attraction-${index}`,
      name,
      address: '대한민국 서울',
      latitude: 37.56,
      longitude: 126.98,
      tag: PlaceTag.Attraction,
      preference: PlacePreference.WantToVisit,
      note: null,
      isPrimaryLodging: false,
    }));
    const trip = {
      id: tripId, title: '서울 여행', destination: '대한민국', timezone: 'Asia/Seoul',
      regions: [{ name: '서울', address: '대한민국', latitude: 37.56, longitude: 126.98 }],
      startDate: '2026-11-22', endDate: '2026-11-22', startPoint: null, endPoint: null,
    };
    const planner = { generate: vi.fn().mockResolvedValue({
      placements: visits.map((place, position) => ({
        savedPlaceId: place.id,
        date: '2026-11-22',
        position,
        startTime: ['09:00', '15:00', '18:00'][position],
        durationMinutes: 180,
        activity: `${place.name} 방문`,
        travelMethod: '대중교통',
        travelDurationMinutes: 0,
      })),
      unplaced: [],
      recommendations: [],
    }) };
    const replace = vi.fn().mockResolvedValue({
      status: ItineraryUpdateStatus.Updated,
      conflicts: [],
      itinerary: { items: [], unplaced: [] },
    });
    const search = vi.fn().mockResolvedValue([{
      googlePlaceId: 'google-lunch', name: '서울 점심 식당', address: '대한민국 서울',
      latitude: 37.56, longitude: 126.98, primaryType: 'korean_restaurant',
    }]);
    const service = new AiPlanningService(
      { findOneBy: vi.fn().mockResolvedValue(trip), save: vi.fn() } as never,
      {
        find: vi.fn().mockResolvedValue(visits),
        create: vi.fn((input: Record<string, unknown>) => input),
        save: vi.fn((input: Record<string, unknown>) => Promise.resolve({ ...input, id: mealId })),
        remove: vi.fn(),
      } as never,
      planner,
      { get: vi.fn().mockResolvedValue({ items: [], unplaced: [] }), replace } as never,
      { getCurrentUserId: vi.fn().mockReturnValue('user-1') },
      { assertAllowed: vi.fn() } as never,
      { assertCanGenerateAiPlan: vi.fn(), recordSuccessfulAiGeneration: vi.fn() } as never,
      { search, getCoordinates: vi.fn(), getPhoto: vi.fn(), getPrimaryType: vi.fn() },
      { transit: vi.fn().mockResolvedValue(null) },
    );

    const result = await service.generate(tripId, {
      density: TravelDensity.Balanced,
      themes: [TravelTheme.Highlights],
      transportModes: [AiTransportMode.PublicTransit],
    });

    expect(result.status).toBe(AiPlanGenerationStatus.Generated);
    expect(planner.generate).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenCalledWith('점심 식사 식당', '대한민국 서울');
    expect(replace).toHaveBeenCalledWith(tripId, expect.arrayContaining([
      expect.objectContaining({
        savedPlaceId: mealId,
        date: '2026-11-22',
        scheduledTime: '12:00',
        durationMinutes: 60,
        activitySummary: '점심 식사',
      }),
    ]), 'ai');
  });

  it('regenerates only the requested date using the latest settings', async () => {
    const tripId = '10000000-0000-4000-8000-000000000020';
    const target = {
      id: '20000000-0000-4000-8000-000000000020', name: '경복궁', address: '서울 종로구',
      latitude: 37.58, longitude: 126.98, tag: PlaceTag.Food, preference: PlacePreference.MustVisit,
      note: null, isPrimaryLodging: false,
    };
    const target2 = { ...target, id: '20000000-0000-4000-8000-000000000022', name: '북촌한옥마을' };
    const target3 = { ...target, id: '20000000-0000-4000-8000-000000000023', name: '광장시장' };
    const otherDay = {
      id: '20000000-0000-4000-8000-000000000021', name: '서울숲', address: '서울 성동구',
      latitude: 37.54, longitude: 127.04, tag: PlaceTag.Attraction, preference: PlacePreference.WantToVisit,
      note: null, isPrimaryLodging: false,
    };
    const sharedRecommendation = {
      ...target,
      id: '20000000-0000-4000-8000-000000000024',
      name: 'AI 추천 카페',
      note: 'AI 추천 · 이전 일정 보완',
    };
    const trip = {
      id: tripId, title: '서울 여행', destination: '대한민국', timezone: 'Asia/Seoul',
      regions: [{ name: '서울', address: '대한민국', latitude: 37.56, longitude: 126.98 }],
      startDate: '2026-11-08', endDate: '2026-11-09', startPoint: null, endPoint: null,
      latestAiPlanRequest: {
        density: TravelDensity.Balanced,
        themes: [TravelTheme.Highlights],
        transportModes: [AiTransportMode.PublicTransit],
      },
    };
    const planner = { generate: vi.fn().mockResolvedValue({
      placements: [target, target2, target3].map((place, position) => ({
        savedPlaceId: place.id, date: '2026-11-08', position,
        startTime: ['09:00', '12:00', '18:00'][position],
        durationMinutes: 150, activity: `${place.name} 식사`, travelMethod: '대중교통', travelDurationMinutes: 0,
      })),
      unplaced: [],
      recommendations: [],
    }) };
    const replaceDay = vi.fn().mockResolvedValue({
      status: ItineraryUpdateStatus.Updated,
      conflicts: [],
      itinerary: { items: [], unplaced: [] },
    });
    const replace = vi.fn();
    const saveTrip = vi.fn();
    const remove = vi.fn();
    const service = new AiPlanningService(
      { findOneBy: vi.fn().mockResolvedValue(trip), save: saveTrip } as never,
      { find: vi.fn().mockResolvedValue([target, target2, target3, otherDay, sharedRecommendation]), remove } as never,
      planner,
      {
        get: vi.fn().mockResolvedValue({
          items: [
            { savedPlaceId: target.id, date: '2026-11-08', position: 0, locked: false },
            { savedPlaceId: target2.id, date: '2026-11-08', position: 1, locked: false },
            { savedPlaceId: target3.id, date: '2026-11-08', position: 2, locked: false },
            { savedPlaceId: sharedRecommendation.id, date: '2026-11-08', position: 3, locked: false },
            { savedPlaceId: otherDay.id, date: '2026-11-09', position: 0, locked: false },
            { savedPlaceId: sharedRecommendation.id, date: '2026-11-09', position: 1, locked: false },
          ],
          unplaced: [],
        }),
        replace,
        replaceDay,
      } as never,
      { getCurrentUserId: vi.fn().mockReturnValue('user-1') },
      { assertAllowed: vi.fn() } as never,
      { assertCanGenerateAiPlan: vi.fn(), recordSuccessfulAiGeneration: vi.fn() } as never,
      { search: vi.fn(), getCoordinates: vi.fn(), getPhoto: vi.fn() },
      { transit: vi.fn().mockResolvedValue(null) },
    );

    const result = await service.generateDay(tripId, '2026-11-08');

    expect(result.status).toBe(AiPlanGenerationStatus.Generated);
    const plannerInput = planner.generate.mock.calls[0]?.[0] as unknown as {
      places: Array<{ id: string }>;
      days: Array<{ date: string }>;
      referenceItinerary: Array<{
        date: string;
        visits: Array<{ placeName: string; address: string | null; scheduledTime: string | null }>;
      }>;
    };
    expect(plannerInput.places.map((place) => place.id)).toEqual([target.id, target2.id, target3.id]);
    expect(plannerInput.days.map((day) => day.date)).toEqual(['2026-11-08']);
    expect(plannerInput.referenceItinerary).toEqual([{
      date: '2026-11-09',
      visits: [
        expect.objectContaining({ placeName: '서울숲', address: '서울 성동구', scheduledTime: null }),
        expect.objectContaining({ placeName: 'AI 추천 카페', address: '서울 종로구', scheduledTime: null }),
      ],
    }]);
    expect(replaceDay).toHaveBeenCalledWith(tripId, '2026-11-08', expect.arrayContaining([
      expect.objectContaining({ savedPlaceId: target.id, date: '2026-11-08' }),
      expect.objectContaining({ savedPlaceId: target2.id, date: '2026-11-08' }),
      expect.objectContaining({ savedPlaceId: target3.id, date: '2026-11-08' }),
    ]), 'ai');
    expect(replace).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(saveTrip).not.toHaveBeenCalled();
  });

  it('creates a complete recommendation-only itinerary without saved places or lodging', async () => {
    const tripId = '10000000-0000-4000-8000-000000000010';
    const recommendationIds = [
      '30000000-0000-4000-8000-000000000010',
      '30000000-0000-4000-8000-000000000011',
      '30000000-0000-4000-8000-000000000012',
      '30000000-0000-4000-8000-000000000013',
    ];
    const recommendations = ['아침 식당', '점심 식당', '저녁 식당'].map((placeName, index) => ({
      placeName,
      regionName: 'Seoul',
      suggestedDate: '2026-11-08',
      position: index,
      startTime: ['09:20', '12:40', '18:00'][index]!,
      durationMinutes: 180,
      activity: `${placeName} 둘러보기`,
      travelMethod: '대중교통',
      travelDurationMinutes: 20,
      reason: '하루 동선을 완성하는 추천',
    }));
    const planner = { generate: vi.fn()
      .mockResolvedValueOnce({
        placements: [{
          savedPlaceId: '30000000-0000-4000-8000-000000000099', date: '2026-11-08', position: 0,
          startTime: '09:00', durationMinutes: 600, activity: '잘못 생성한 장소',
          travelMethod: '대중교통', travelDurationMinutes: 20,
        }],
        unplaced: [],
        recommendations: [],
      })
      .mockResolvedValueOnce({
        placements: [],
        unplaced: [],
        recommendations: recommendations.map((recommendation) => ({
          ...recommendation,
          durationMinutes: 30,
          travelDurationMinutes: 10,
        })),
      })
      .mockResolvedValue({
        placements: [],
        unplaced: [],
        recommendations,
        savedRecommendations: [{ placeName: '서울공예박물관', regionName: 'Seoul', reason: '시간이 되면 추천할 명소' }],
      }) };
    const replace = vi.fn().mockResolvedValue({
      status: ItineraryUpdateStatus.Updated,
      conflicts: [],
      itinerary: { items: [], unplaced: [] },
    });
    const saveTrip = vi.fn((input: Record<string, unknown>) => Promise.resolve(input));
    const idsByName = new Map([
      ['아침 식당', recommendationIds[0]],
      ['점심 식당', recommendationIds[1]],
      ['저녁 식당', recommendationIds[2]],
      ['서울공예박물관', recommendationIds[3]],
    ]);
    const savePlace = vi.fn((input: Record<string, unknown>) => Promise.resolve({
      ...input,
      id: idsByName.get(String(input.name)),
    }));
    const service = new AiPlanningService(
      { findOneBy: vi.fn().mockResolvedValue({
        id: tripId, title: '서울 자유 여행', destination: 'Korea', timezone: 'Asia/Seoul',
        regions: [{ name: 'Seoul', address: 'South Korea', latitude: 37.56, longitude: 126.98 }],
        startDate: '2026-11-08', endDate: '2026-11-08',
        startPoint: null, endPoint: null,
      }), save: saveTrip } as never,
      {
        find: vi.fn().mockResolvedValue([]),
        create: vi.fn((input: Record<string, unknown>) => input),
        save: savePlace,
        remove: vi.fn(),
      } as never,
      planner,
      { get: vi.fn().mockResolvedValue({ items: [], unplaced: [] }), replace } as never,
      { getCurrentUserId: vi.fn().mockReturnValue('user-1') },
      { assertAllowed: vi.fn() } as never,
      { assertCanGenerateAiPlan: vi.fn(), recordSuccessfulAiGeneration: vi.fn() } as never,
      {
        search: vi.fn((query: string) => Promise.resolve([{
          googlePlaceId: `google-${query}`, name: query, address: 'Seoul Seongdong-gu',
          latitude: 37.55, longitude: 127.04, primaryType: query.includes('식당') ? 'restaurant' : 'tourist_attraction',
        }])),
        getCoordinates: vi.fn(),
        getPhoto: vi.fn(),
      },
      { transit: vi.fn().mockResolvedValue(null) },
    );

    const request = {
      density: TravelDensity.Relaxed,
      themes: [TravelTheme.Highlights],
      transportModes: [AiTransportMode.PublicTransit],
    };
    const result = await service.generate(tripId, request);

    expect(result.status).toBe('generated');
    expect(saveTrip).toHaveBeenCalledWith(expect.objectContaining({
      latestAiPlanRequest: request,
    }));
    expect(planner.generate).toHaveBeenCalledWith(expect.objectContaining({
      places: [],
      days: [expect.objectContaining({ startLodging: null, endLodging: null, targetPlannedMinutes: 420 })],
    }));
    expect(planner.generate).toHaveBeenCalledTimes(4);
    const revisionInput = planner.generate.mock.calls[1]?.[0] as unknown as { revisionGuidance?: string };
    expect(revisionInput.revisionGuidance).toContain('Return placements as []');
    const secondRevisionInput = planner.generate.mock.calls[2]?.[0] as unknown as { revisionGuidance?: string };
    expect(secondRevisionInput.revisionGuidance).toContain('still too short on: 2026-11-08');
    expect(secondRevisionInput.revisionGuidance).toContain('2026-11-08=420 minutes');
    expect(replace).toHaveBeenCalledWith(tripId, expect.arrayContaining([
      expect.objectContaining({ savedPlaceId: recommendationIds[0], position: 0 }),
      expect.objectContaining({ savedPlaceId: recommendationIds[1], position: 1 }),
      expect.objectContaining({ savedPlaceId: recommendationIds[2], position: 2 }),
    ]), 'ai');
    expect(savePlace).toHaveBeenCalledWith(expect.objectContaining({
      name: '서울공예박물관',
      note: 'AI 추천 · 보관함 · 시간이 되면 추천할 명소',
    }));
    expect(replace).not.toHaveBeenCalledWith(
      tripId,
      expect.arrayContaining([expect.objectContaining({ savedPlaceId: recommendationIds[3] })]),
      'ai',
    );
  });

  it('sends enriched trip, place, style, and daily lodging context to the planner', async () => {
    const tripId = '10000000-0000-4000-8000-000000000001';
    const primary = {
      id: '20000000-0000-4000-8000-000000000001', name: 'Seoul hotel', address: 'Seoul Jung-gu',
      latitude: 37.56, longitude: 126.98, tag: PlaceTag.Lodging, preference: PlacePreference.WantToVisit,
      note: null, isPrimaryLodging: true,
    };
    const secondary = {
      id: '20000000-0000-4000-8000-000000000002', name: 'Inje hotel', address: 'Inje-gun',
      latitude: 38.06, longitude: 128.17, tag: PlaceTag.Lodging, preference: PlacePreference.WantToVisit,
      note: null, isPrimaryLodging: false,
    };
    const visit = {
      id: '30000000-0000-4000-8000-000000000001', name: '원대리 자작나무숲', address: '강원특별자치도 인제군',
      latitude: 38.2, longitude: 128.24, tag: PlaceTag.Food, preference: PlacePreference.MustVisit,
      note: 'Morning visit', isPrimaryLodging: false,
    };
    const previousAiRecommendation = {
      id: '30000000-0000-4000-8000-000000000099', name: 'Old AI cafe', address: 'Seoul Mapo-gu',
      latitude: 37.55, longitude: 126.92, tag: PlaceTag.Cafe, preference: PlacePreference.IfTimeAllows,
      note: 'AI 추천 · 이전 일정 보완', isPrimaryLodging: false,
    };
    const recommendedIds = [
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003',
    ];
    const remove = vi.fn().mockResolvedValue([]);
    const validPlannerOutput = {
      placements: [{
        savedPlaceId: visit.id, date: '2026-11-08', position: 0,
        startTime: '09:00', durationMinutes: 240, activity: '서울숲 산책과 주요 구역 관람',
        travelMethod: '대중교통', travelDurationMinutes: 20,
      }],
      unplaced: [],
      recommendations: [{
        placeName: 'Gyeongbokgung', regionName: 'Seoul', suggestedDate: '2026-11-08', position: 1,
        startTime: '13:00', durationMinutes: 240, activity: '경복궁 주요 전각 관람', reason: 'A central historic destination',
        travelMethod: '대중교통', travelDurationMinutes: 25,
      }, {
        placeName: 'Dinner restaurant', regionName: 'Seoul', suggestedDate: '2026-11-08', position: 2,
        startTime: '18:00', durationMinutes: 90, activity: '저녁 식사', reason: 'A local dinner restaurant',
        travelMethod: '대중교통', travelDurationMinutes: 15,
      }],
    };
    const planner = {
      generate: vi.fn()
        .mockResolvedValueOnce({
          placements: [],
          unplaced: [{ savedPlaceId: visit.id, reason: '선택 도시 밖 장소' }],
          recommendations: [],
        })
        .mockResolvedValue(validPlannerOutput),
    };
    const replace = vi.fn().mockResolvedValue({
      status: ItineraryUpdateStatus.Updated,
      conflicts: [],
      itinerary: { items: [], unplaced: [] },
    });
    const service = new AiPlanningService(
      { findOneBy: vi.fn().mockResolvedValue({
        id: tripId, title: 'Seoul autumn trip', destination: 'Korea', timezone: 'Asia/Seoul',
        regions: [{ name: 'Seoul', address: 'South Korea', latitude: 37.56, longitude: 126.98 }],
        startDate: '2026-11-08', endDate: '2026-11-08',
        startPoint: null, endPoint: null,
      }), save: vi.fn((input: Record<string, unknown>) => Promise.resolve(input)) } as never,
      {
        find: vi.fn().mockResolvedValue([primary, secondary, visit, previousAiRecommendation]),
        create: vi.fn((input: Record<string, unknown>) => input),
        save: vi.fn((input: Record<string, unknown>) => Promise.resolve({
          ...input,
          id: String(input.name) === 'Gyeongbokgung' ? recommendedIds[0] : recommendedIds[1],
        })),
        remove,
      } as never,
      planner,
      {
        get: vi.fn().mockResolvedValue({ items: [
          { savedPlaceId: secondary.id, date: '2026-11-08', position: 0, locked: false },
          { savedPlaceId: visit.id, date: '2026-11-08', position: 1, locked: false },
          { savedPlaceId: primary.id, date: '2026-11-08', position: 2, locked: false },
        ], unplaced: [] }),
        replace,
      } as never,
      { getCurrentUserId: vi.fn().mockReturnValue('user-1') },
      { assertAllowed: vi.fn() } as never,
      { assertCanGenerateAiPlan: vi.fn(), recordSuccessfulAiGeneration: vi.fn() } as never,
      {
        search: vi.fn((query: string) => Promise.resolve([{
          googlePlaceId: `google-${query}`, name: query, address: 'Seoul Jongno-gu',
          latitude: 37.58, longitude: 126.98, primaryType: 'restaurant',
        }])),
        getCoordinates: vi.fn(),
        getPhoto: vi.fn(),
      },
      { transit: vi.fn() },
    );

    await service.generate(tripId, {
      density: TravelDensity.Relaxed,
      themes: [TravelTheme.Highlights],
      transportModes: [AiTransportMode.PublicTransit],
    });

    expect(planner.generate).toHaveBeenCalledWith({
      task: AI_PLANNING_TASK,
      trip: {
        title: 'Seoul autumn trip', destination: 'Korea', timezone: 'Asia/Seoul',
        regions: [{ name: 'Seoul', address: 'South Korea', latitude: 37.56, longitude: 126.98 }],
        startDate: '2026-11-08', endDate: '2026-11-08',
        startPoint: null, endPoint: null,
      },
      density: TRAVEL_DENSITY_POLICIES[TravelDensity.Relaxed],
      travelerContext: {
        companions: null,
        transportModes: [AiTransportMode.PublicTransit],
        budgetLevel: null,
        themes: [TravelTheme.Highlights],
        additionalRequests: null,
        requiredActivityRequests: [],
      },
      places: [{
        id: visit.id, name: visit.name, address: visit.address, latitude: visit.latitude, longitude: visit.longitude,
        tag: visit.tag, preference: visit.preference, note: visit.note, primaryType: null, regularOpeningHours: null,
      }],
      days: [{
        date: '2026-11-08',
        isFirstDay: true,
        isLastDay: true,
        startLodging: null,
        endLodging: null,
        availableStartTime: '09:00',
        availableEndTime: '21:00',
        targetPlannedMinutes: 420,
        hasStartBoundary: false,
        hasEndBoundary: false,
      }],
      referenceItinerary: [],
      lockedPlacements: [],
      priorRecommendations: [previousAiRecommendation.name],
    });
    const retryInput = planner.generate.mock.calls[1]?.[0] as unknown as AiPlannerInput;
    expect(retryInput.revisionGuidance).toContain('explicit traveler-approved exception');
    expect(retryInput.revisionGuidance).toContain(visit.name);
    expect(retryInput.revisionDraft).toEqual({
      placements: [],
      unplaced: [{ savedPlaceId: visit.id, reason: '선택 도시 밖 장소' }],
      placeDescriptions: [],
      recommendations: [],
      savedRecommendations: [],
    });
    expect(replace).toHaveBeenCalledWith(tripId, [
      {
        savedPlaceId: visit.id, date: '2026-11-08', position: 0, locked: false,
        scheduledTime: '09:20', durationMinutes: 240, activitySummary: '서울숲 산책과 주요 구역 관람',
        travelMethod: '대중교통', travelDurationMinutes: 20,
      },
      {
        savedPlaceId: '30000000-0000-4000-8000-000000000002', date: '2026-11-08', position: 1, locked: false,
        scheduledTime: '13:45', durationMinutes: 240, activitySummary: '경복궁 주요 전각 관람',
        travelMethod: '대중교통', travelDurationMinutes: 25,
      },
      {
        savedPlaceId: '30000000-0000-4000-8000-000000000003', date: '2026-11-08', position: 2, locked: false,
        scheduledTime: '18:00', durationMinutes: 90, activitySummary: '저녁 식사',
        travelMethod: '대중교통', travelDurationMinutes: 15,
      },
    ], 'ai');
    expect(remove).not.toHaveBeenCalledWith([previousAiRecommendation]);
  });
});
