import { describe, expect, it, vi } from 'vitest';

import { PlaceTag } from '../../places/domain/entities/saved-place.entity';
import { PlacePreference } from '../../places/domain/entities/saved-place.entity';
import { ItineraryUpdateStatus } from '../../itineraries/application/dto/itinerary.dto';
import {
  AI_PLANNING_TASK,
  TRAVEL_DENSITY_POLICIES,
  TravelDensity,
  TravelTheme,
} from '../domain/ai-planner.port';
import { AiPlanGenerationStatus, AiTransportMode } from './dto/generate-ai-plan.dto';
import {
  addLodgingEndpoints,
  applyDailyPlanningTargets,
  assessPlanQuality,
  assessRawOutputContract,
  assessRawDayCoverage,
  AiPlanningService,
  buildPlannerDays,
  enumerateTripDates,
  findReusableAiRecommendation,
  isRecommendableCandidate,
  isBlockingQualityIssue,
  isWithinSelectedRegions,
  normalizeGeneratedPlacements,
} from './ai-planning.service';

describe('AI plan quality severity', () => {
  it('blocks every unresolved quality issue from reaching the user', () => {
    expect(isBlockingQualityIssue('underfilled_day:2026-11-08')).toBe(true);
    expect(isBlockingQualityIssue('long_travel_leg:2026-11-08')).toBe(true);
    expect(isBlockingQualityIssue('saved_places_missing')).toBe(true);
    expect(isBlockingQualityIssue('schedule_detail_missing:2026-11-08')).toBe(true);
    expect(isBlockingQualityIssue('outside_available_window:2026-11-08')).toBe(true);
  });

  it('rejects a sparse or out-of-window final plan instead of accepting it with warnings', () => {
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
      output: { placements: [], unplaced: [], recommendations: [] },
    });

    expect(issues).toEqual(expect.arrayContaining([
      'underfilled_day:2026-11-08',
      'outside_available_window:2026-11-08',
    ]));
    expect(issues.every(isBlockingQualityIssue)).toBe(true);
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
        date: '2026-11-08', availableStartTime: '15:30', availableEndTime: '21:00', targetPlannedMinutes: 270,
      }),
      expect.objectContaining({
        date: '2026-11-09', availableStartTime: '09:00', availableEndTime: '12:00', targetPlannedMinutes: 120,
      }),
    ]);
  });

  it('keeps the style target for full days', () => {
    expect(applyDailyPlanningTargets(days, TravelDensity.Busy, null, null)).toEqual([
      expect.objectContaining({ targetPlannedMinutes: 480 }),
      expect.objectContaining({ targetPlannedMinutes: 480 }),
    ]);
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

  it('regenerates only the requested date using the latest settings', async () => {
    const tripId = '10000000-0000-4000-8000-000000000020';
    const target = {
      id: '20000000-0000-4000-8000-000000000020', name: '경복궁', address: '서울 종로구',
      latitude: 37.58, longitude: 126.98, tag: PlaceTag.Attraction, preference: PlacePreference.MustVisit,
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
        startTime: ['09:00', '10:30', '12:00'][position],
        durationMinutes: 90, activity: `${place.name} 관람`, travelMethod: '대중교통', travelDurationMinutes: 0,
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
      { search: vi.fn(), getCoordinates: vi.fn() },
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
    ];
    const recommendations = ['서울숲', '성수 미술관', '성수 카페'].map((placeName, index) => ({
      placeName,
      regionName: 'Seoul',
      suggestedDate: '2026-11-08',
      position: index,
      startTime: ['09:20', '12:40', '16:00'][index]!,
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
      .mockResolvedValue({ placements: [], unplaced: [], recommendations }) };
    const replace = vi.fn().mockResolvedValue({
      status: ItineraryUpdateStatus.Updated,
      conflicts: [],
      itinerary: { items: [], unplaced: [] },
    });
    let savedIndex = 0;
    const saveTrip = vi.fn((input: Record<string, unknown>) => Promise.resolve(input));
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
        save: vi.fn((input: Record<string, unknown>) => Promise.resolve({ ...input, id: recommendationIds[savedIndex++] })),
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
          latitude: 37.55, longitude: 127.04, primaryType: 'tourist_attraction',
        }])),
        getCoordinates: vi.fn(),
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
    expect(planner.generate).toHaveBeenCalledTimes(3);
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
      latitude: 38.2, longitude: 128.24, tag: PlaceTag.Activity, preference: PlacePreference.MustVisit,
      note: 'Morning visit', isPrimaryLodging: false,
    };
    const previousAiRecommendation = {
      id: '30000000-0000-4000-8000-000000000099', name: 'Old AI cafe', address: 'Seoul Mapo-gu',
      latitude: 37.55, longitude: 126.92, tag: PlaceTag.Cafe, preference: PlacePreference.IfTimeAllows,
      note: 'AI 추천 · 이전 일정 보완', isPrimaryLodging: false,
    };
    const recommendedId = '30000000-0000-4000-8000-000000000002';
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
        save: vi.fn((input: Record<string, unknown>) => Promise.resolve({ ...input, id: recommendedId })),
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
        search: vi.fn().mockResolvedValue([{
          googlePlaceId: 'google-palace', name: 'Gyeongbokgung', address: 'Seoul Jongno-gu',
          latitude: 37.58, longitude: 126.98, primaryType: 'tourist_attraction',
        }]),
        getCoordinates: vi.fn(),
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
      },
      places: [{
        id: visit.id, name: visit.name, address: visit.address, latitude: visit.latitude, longitude: visit.longitude,
        tag: visit.tag, preference: visit.preference, note: visit.note,
      }],
      days: [{
        date: '2026-11-08',
        startLodging: null,
        endLodging: null,
        availableStartTime: '09:00',
        availableEndTime: '21:00',
        targetPlannedMinutes: 420,
      }],
      referenceItinerary: [],
      lockedPlacements: [],
      priorRecommendations: [previousAiRecommendation.name],
    });
    const retryInput = planner.generate.mock.calls[1]?.[0] as unknown as { revisionGuidance: string };
    expect(retryInput.revisionGuidance).toContain('explicit traveler-approved exception');
    expect(retryInput.revisionGuidance).toContain(visit.name);
    expect(replace).toHaveBeenCalledWith(tripId, [
      {
        savedPlaceId: visit.id, date: '2026-11-08', position: 0, locked: false,
        scheduledTime: '09:20', durationMinutes: 240, activitySummary: '서울숲 산책과 주요 구역 관람',
        travelMethod: '대중교통', travelDurationMinutes: 20,
      },
      {
        savedPlaceId: recommendedId, date: '2026-11-08', position: 1, locked: false,
        scheduledTime: '13:45', durationMinutes: 240, activitySummary: '경복궁 주요 전각 관람',
        travelMethod: '대중교통', travelDurationMinutes: 25,
      },
    ], 'ai');
    expect(remove).toHaveBeenCalledWith([previousAiRecommendation]);
  });
});
