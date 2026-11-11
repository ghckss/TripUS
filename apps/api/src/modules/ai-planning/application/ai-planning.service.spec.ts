import { describe, expect, it, vi } from 'vitest';

import { PlaceTag } from '../../places/domain/entities/saved-place.entity';
import { PlacePreference } from '../../places/domain/entities/saved-place.entity';
import { ItineraryUpdateStatus } from '../../itineraries/application/dto/itinerary.dto';
import { AI_PLANNING_TASK, TRAVEL_STYLE_POLICIES, TravelStyle } from '../domain/ai-planner.port';
import {
  addLodgingEndpoints,
  AiPlanningService,
  buildPlannerDays,
  isSavedPlaceWithinSelectedRegions,
  isWithinSelectedRegions,
  normalizeGeneratedPlacements,
} from './ai-planning.service';

describe('addLodgingEndpoints', () => {
  it('wraps each trip day with its own start and end lodging', () => {
    const result = addLodgingEndpoints([
      { savedPlaceId: 'place-1', date: '2026-11-08', position: 0, locked: false },
    ], [
      {
        date: '2026-11-08',
        startTime: '09:00',
        endTime: '21:00',
        startLodging: { savedPlaceId: 'lodging-1', name: 'First hotel', address: null, latitude: null, longitude: null },
        endLodging: { savedPlaceId: 'lodging-2', name: 'Second hotel', address: null, latitude: null, longitude: null },
      },
      {
        date: '2026-11-09',
        startTime: '09:00',
        endTime: '21:00',
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
      [{ date: '2026-11-08', startTime: '09:00', endTime: '21:00' }],
      [
        { savedPlaceId: secondary.id, date: '2026-11-08', position: 0 },
        { savedPlaceId: visit.id, date: '2026-11-08', position: 1 },
        { savedPlaceId: primary.id, date: '2026-11-08', position: 2 },
      ],
      [primary, secondary, visit],
      primary,
    );

    expect(result[0]?.startLodging?.savedPlaceId).toBe(secondary.id);
    expect(result[0]?.endLodging?.savedPlaceId).toBe(primary.id);
    expect(result[0]?.startLodging).toMatchObject({ address: 'Inje', latitude: 38, longitude: 128 });
  });

  it('falls back to the primary lodging when a boundary has not been saved yet', () => {
    const result = buildPlannerDays(
      [{ date: '2026-11-08', startTime: '09:00', endTime: '21:00' }],
      [{ savedPlaceId: visit.id, date: '2026-11-08', position: 0 }],
      [primary, visit],
      primary,
    );
    expect(result[0]?.startLodging?.savedPlaceId).toBe(primary.id);
    expect(result[0]?.endLodging?.savedPlaceId).toBe(primary.id);
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
});

describe('selected-region planning scope', () => {
  it('excludes saved places outside selected cities', () => {
    expect(isSavedPlaceWithinSelectedRegions(
      { name: '원대리 자작나무숲', address: '강원특별자치도 인제군' },
      [{ name: '서울특별시' }],
    )).toBe(false);
    expect(isSavedPlaceWithinSelectedRegions(
      { name: '당산역', address: '서울특별시 영등포구' },
      [{ name: '서울특별시' }],
    )).toBe(true);
  });

});

describe('AiPlanningService', () => {
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
      id: '30000000-0000-4000-8000-000000000001', name: 'Seoul Forest', address: 'Seoul Seongdong-gu',
      latitude: 38.2, longitude: 128.24, tag: PlaceTag.Activity, preference: PlacePreference.MustVisit,
      note: 'Morning visit', isPrimaryLodging: false,
    };
    const recommendedId = '30000000-0000-4000-8000-000000000002';
    const planner = {
      generate: vi.fn().mockResolvedValue({
        placements: [{
          savedPlaceId: visit.id, date: '2026-11-08', position: 0,
          startTime: '10:00', durationMinutes: 90, activity: '서울숲 산책과 주요 구역 관람',
          travelMethod: '대중교통', travelDurationMinutes: 20,
        }],
        unplaced: [],
        recommendations: [{
          placeName: 'Gyeongbokgung', regionName: 'Seoul', suggestedDate: '2026-11-08', position: 1,
          startTime: '14:00', durationMinutes: 90, activity: '경복궁 주요 전각 관람', reason: 'A central historic destination',
          travelMethod: '대중교통', travelDurationMinutes: 25,
        }],
        planBs: [{ date: '2026-11-08', placeName: 'Gyeongbokgung', regionName: 'Seoul', reason: '비가 오면 실내 전시 위주로 관람' }],
      }),
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
      }) } as never,
      {
        find: vi.fn().mockResolvedValue([primary, secondary, visit]),
        create: vi.fn((input: Record<string, unknown>) => input),
        save: vi.fn((input: Record<string, unknown>) => Promise.resolve({ ...input, id: recommendedId })),
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
        get: vi.fn().mockResolvedValue([{ date: '2026-11-08', startTime: '09:00', endTime: '21:00' }]),
        applyAiPlanBs: vi.fn().mockResolvedValue([]),
      } as never,
      {
        search: vi.fn().mockResolvedValue([{
          googlePlaceId: 'google-palace', name: 'Gyeongbokgung', address: 'Seoul Jongno-gu',
          latitude: 37.58, longitude: 126.98, primaryType: 'tourist_attraction',
        }]),
        getCoordinates: vi.fn(),
      },
      { transit: vi.fn() },
    );

    await service.generate(tripId, { style: TravelStyle.Relaxed });

    expect(planner.generate).toHaveBeenCalledWith({
      task: AI_PLANNING_TASK,
      trip: {
        title: 'Seoul autumn trip', destination: 'Korea', timezone: 'Asia/Seoul',
        regions: [{ name: 'Seoul', address: 'South Korea', latitude: 37.56, longitude: 126.98 }],
        startDate: '2026-11-08', endDate: '2026-11-08',
      },
      style: TRAVEL_STYLE_POLICIES[TravelStyle.Relaxed],
      travelerContext: {
        companions: null,
        transportMode: null,
        budgetLevel: null,
        preferences: null,
        avoidances: null,
      },
      places: [{
        id: visit.id, name: visit.name, address: visit.address, latitude: visit.latitude, longitude: visit.longitude,
        tag: visit.tag, preference: visit.preference, note: visit.note,
      }],
      days: [{
        date: '2026-11-08', startTime: '09:00', endTime: '21:00',
        startLodging: {
          savedPlaceId: secondary.id, name: secondary.name, address: secondary.address,
          latitude: secondary.latitude, longitude: secondary.longitude,
        },
        endLodging: {
          savedPlaceId: primary.id, name: primary.name, address: primary.address,
          latitude: primary.latitude, longitude: primary.longitude,
        },
      }],
      lockedPlacements: [],
    });
    expect(replace).toHaveBeenCalledWith(tripId, [
      { savedPlaceId: secondary.id, date: '2026-11-08', position: 0, locked: false },
      {
        savedPlaceId: visit.id, date: '2026-11-08', position: 1, locked: false,
        scheduledTime: '10:00', durationMinutes: 90, activitySummary: '서울숲 산책과 주요 구역 관람',
        travelMethod: '대중교통', travelDurationMinutes: 20,
      },
      {
        savedPlaceId: recommendedId, date: '2026-11-08', position: 2, locked: false,
        scheduledTime: '14:00', durationMinutes: 90, activitySummary: '경복궁 주요 전각 관람',
        travelMethod: '대중교통', travelDurationMinutes: 25,
      },
      { savedPlaceId: primary.id, date: '2026-11-08', position: 3, locked: false },
    ], 'ai');
  });
});
