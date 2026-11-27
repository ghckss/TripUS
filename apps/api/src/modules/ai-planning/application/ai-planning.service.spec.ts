import { describe, expect, it, vi } from 'vitest';
import { AiPlanningService, addLodgingEndpoints, isGenericActivityName, isInvalidAiPlaceholderPlace } from './ai-planning.service';
import { AiPlannerError, TravelTheme, type AiPlannerInput, type AiPlannerOutput, type AiPlannerVisit } from '../domain/ai-planner.port';
import { AiBudgetLevel, AiTransportMode } from './dto/generate-ai-plan.dto';
import * as logs from '../../../common/http/json-logger';

type StoredPlacement = { savedPlaceId: string; date: string; position: number; locked?: boolean; scheduledTime?: string; durationMinutes?: number };
const date = '2026-12-03';
const visit: AiPlannerVisit = {
  savedPlaceId: null, placeName: 'AI 추천 장소', regionName: '파리',
  startTime: '23:00', durationMinutes: 30, description: '강변의 정원과 파리 풍경', mealType: 'lunch',
};
const draft: AiPlannerOutput = { days: [{ date, visits: [visit] }] };
const request = {
  themes: [TravelTheme.Highlights], companions: '친구 2명',
  transportModes: [AiTransportMode.PublicTransit, AiTransportMode.Walking],
  budgetLevel: AiBudgetLevel.Premium, additionalRequests: '와인과 치즈, 노르망디 투어',
};
function place(id: string, note: string | null = null, lodging = false) {
  return { id, name: id, tripId: 'trip', tag: lodging ? 'lodging' : 'attraction', isPrimaryLodging: lodging, note, googlePlaceId: id, address: 'Paris', latitude: 48.85, longitude: 2.35 };
}
function setup(latestAiPlanRequest: Record<string, unknown> | null = null) {
  let sequence = 0;
  const trip = { id: 'trip', title: 'Paris', destination: '프랑스', timezone: 'Europe/Paris', regions: [{ name: '파리', latitude: 48.85, longitude: 2.35 }], startDate: date, endDate: date, startPoint: null, endPoint: null, latestAiPlanRequest };
  const original = { items: [] as StoredPlacement[], unplaced: [] };
  const savedPlaces: ReturnType<typeof place>[] = [];
  const generate = vi.fn<(input: AiPlannerInput) => Promise<AiPlannerOutput>>().mockResolvedValue(draft);
  const search = vi.fn().mockResolvedValue([{ googlePlaceId: 'school', name: '파리 이름의 한국 학교', address: '대한민국 서울', primaryType: 'school', latitude: 37.55, longitude: 126.98 }]);
  const save = vi.fn((value: object | object[]) => Promise.resolve(Array.isArray(value) ? value : { ...value, id: `place-${++sequence}` }));
  const findOneByPlace = vi.fn(({ googlePlaceId }: { googlePlaceId: string }) => Promise.resolve(savedPlaces.find((item) => item.googlePlaceId === googlePlaceId) ?? null));
  const remove = vi.fn().mockResolvedValue(undefined);
  const replace = vi.fn().mockImplementation((_id: string, items: StoredPlacement[]) => Promise.resolve({ status: 'updated', conflicts: [], itinerary: { items, unplaced: [] } }));
  const replaceDay = vi.fn().mockImplementation((_id: string, _date: string, items: StoredPlacement[]) => Promise.resolve({ status: 'updated', conflicts: [], itinerary: { items, unplaced: [] } }));
  const get = vi.fn().mockResolvedValue(original);
  const record = vi.fn();
  const saveTrip = vi.fn();
  const service = new AiPlanningService(
    { findOneBy: vi.fn().mockResolvedValue(trip), save: saveTrip } as never,
    {
      find: vi.fn().mockResolvedValue(savedPlaces), create: vi.fn((value: object) => value), save, remove,
      findOneBy: findOneByPlace,
    } as never,
    { generate }, { get, replace, replaceDay } as never,
    { getCurrentUserId: () => 'user' }, { assertAllowed: vi.fn() } as never,
    { assertCanGenerateAiPlan: vi.fn(), recordSuccessfulAiGeneration: record } as never,
    { search } as never,
  );
  return { service, generate, search, replace, replaceDay, save, saveTrip, remove, record, original, savedPlaces, trip, findOneByPlace };
}

describe('day visit materialization', () => {
  it('merges registered and new visits in array order and preserves user notes', async () => {
    const { service, generate, savedPlaces, replace, search, save } = setup();
    savedPlaces.push(place('museum', '사용자가 남긴 메모'), place('garden'));
    generate.mockResolvedValue({ days: [{ date, visits: [
      { ...visit, savedPlaceId: 'museum', description: '박물관의 고전 회화' },
      visit,
      { ...visit, savedPlaceId: 'garden', description: '계절별 정원 풍경' },
    ] }] });
    expect((await service.generate('trip', request)).status).toBe('generated');
    expect(replace).toHaveBeenCalledWith('trip', [
      expect.objectContaining({ savedPlaceId: 'museum', position: 0, activitySummary: '박물관의 고전 회화' }),
      expect.objectContaining({ savedPlaceId: 'place-1', position: 1 }),
      expect.objectContaining({ savedPlaceId: 'garden', position: 2 }),
    ], 'ai', []);
    expect(search).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ note: `AI 추천 · ${visit.description}` }));
    expect(savedPlaces[0]?.note).toBe('사용자가 남긴 메모');
    expect(savedPlaces[1]?.note).toBe('계절별 정원 풍경');
  });

  it('retains search failures and empty results as visits with unknown metadata', async () => {
    const { service, search, generate, save, replace } = setup();
    generate.mockResolvedValue({ days: [{ date, visits: [visit, { ...visit, placeName: '다른 장소' }] }] });
    search.mockRejectedValueOnce(new Error('lookup unavailable')).mockResolvedValueOnce([]);
    expect((await service.generate('trip', request)).status).toBe('generated');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: visit.placeName, googlePlaceId: null, latitude: null, longitude: null }));
    expect(replace.mock.calls[0]![1]).toHaveLength(2);
  });

  it('does not save an unresolved activity description as a map place', async () => {
    const { service, search, generate, save, replace } = setup();
    generate.mockResolvedValue({ days: [{ date, visits: [
      { ...visit, placeName: '편의점 도시락 픽업' },
      { ...visit, placeName: '에펠탑', startTime: '14:00' },
    ] }] });
    search.mockResolvedValue([]);

    expect((await service.generate('trip', request)).status).toBe('generated');

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: '에펠탑' }));
    expect(replace.mock.calls[0]![1]).toEqual([
      expect.objectContaining({ savedPlaceId: 'place-1', position: 0, scheduledTime: '14:00' }),
    ]);
  });

  it('removes a previously saved coordinate-less AI activity placeholder before replanning', async () => {
    const { service, savedPlaces, remove } = setup();
    const placeholder = place('generic-ai', 'AI 추천 · 야식 준비');
    Object.assign(placeholder, {
      name: '편의점 도시락 픽업 및 야식 준비',
      googlePlaceId: null,
      latitude: null,
      longitude: null,
    });
    savedPlaces.push(placeholder);

    await service.generate('trip', request);

    expect(remove).toHaveBeenCalledWith([placeholder]);
  });

  it('reuses a Google place entity while preserving visits on different dates', async () => {
    const { service, trip, generate, replace, save } = setup();
    trip.endDate = '2026-12-04';
    generate.mockResolvedValue({ days: [
      { date, visits: [visit] }, { date: trip.endDate, visits: [{ ...visit, startTime: '13:00', durationMinutes: 90 }] },
    ] });
    await service.generate('trip', request);
    expect(save).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]![1]).toMatchObject([
      { savedPlaceId: 'place-1', date, position: 0, scheduledTime: '23:00' },
      { savedPlaceId: 'place-1', date: trip.endDate, position: 0, scheduledTime: '13:00', durationMinutes: 90 },
    ]);
  });

  it('preserves locked visits without duplicating their model references', async () => {
    const { service, original, savedPlaces, generate, replace } = setup();
    savedPlaces.push(place('locked'));
    original.items.push({ savedPlaceId: 'locked', date, position: 0, locked: true, scheduledTime: '10:00', durationMinutes: 60 });
    generate.mockResolvedValue({ days: [{ date, visits: [{ ...visit, savedPlaceId: 'locked' }, visit] }] });
    await service.generate('trip', request);
    expect(replace.mock.calls[0]![1]).toMatchObject([
      { savedPlaceId: 'locked', locked: true, scheduledTime: '10:00', durationMinutes: 60 },
      { savedPlaceId: 'place-1', position: 1 },
    ]);
    expect(replace.mock.calls[0]![1]).toHaveLength(2);
  });

  it('reorders generated visits around a preserved visit so stored times never run backwards', async () => {
    const { service, original, savedPlaces, generate, replace } = setup();
    savedPlaces.push(place('locked'));
    original.items.push({ savedPlaceId: 'locked', date, position: 0, locked: true, scheduledTime: '17:05', durationMinutes: 30 });
    generate.mockResolvedValue({ days: [{ date, visits: [
      { ...visit, placeName: '이른 식당', startTime: '16:45' },
      { ...visit, placeName: '저녁 장소', startTime: '18:00' },
    ] }] });

    await service.generate('trip', request);

    expect((replace.mock.calls[0]![1] as StoredPlacement[]).map((item) => [item.savedPlaceId, item.scheduledTime, item.position])).toEqual([
      ['place-1', '16:45', 0],
      ['locked', '17:05', 1],
      ['place-1', '18:00', 2],
    ]);
  });

  it('keeps unused registered places and previous AI recommendations in the library', async () => {
    const { service, original, savedPlaces, remove } = setup();
    savedPlaces.push(place('unused'), place('old-ai', 'AI 추천 · 이전 설명'));
    original.items.push({ savedPlaceId: 'old-ai', date, position: 0 });
    await service.generate('trip', request);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(['unknown_id', 'outside_date', 'duplicate_date'])('preserves the old itinerary on invalid reference %s', async (kind) => {
    const { service, generate, replace, save, original } = setup();
    generate.mockResolvedValue({ days: kind === 'duplicate_date'
      ? [{ date, visits: [visit] }, { date, visits: [visit] }]
      : [{ date: kind === 'outside_date' ? '2026-12-04' : date, visits: [{ ...visit, savedPlaceId: kind === 'unknown_id' ? 'not-owned' : null }] }] });
    expect(await service.generate('trip', request)).toMatchObject({ status: 'unavailable', failureReason: 'invalid_output', itinerary: original });
    expect(replace).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('cleans up partially created places if a later place write fails', async () => {
    const { service, generate, save, search, remove, replace } = setup();
    generate.mockResolvedValue({ days: [{ date, visits: [visit, { ...visit, placeName: '두 번째' }] }] });
    search.mockResolvedValue([]);
    save.mockResolvedValueOnce({ id: 'first' }).mockRejectedValueOnce(new Error('database unavailable'));
    expect((await service.generate('trip', request)).status).toBe('unavailable');
    expect(remove).toHaveBeenCalledWith([{ id: 'first' }]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('reuses the concurrently inserted Google place instead of failing generation', async () => {
    const { service, generate, save, findOneByPlace, replace } = setup();
    const concurrent = place('concurrent-place', 'AI 추천 · 다른 생성에서 저장');
    concurrent.googlePlaceId = 'school';
    generate.mockResolvedValue({ days: [{ date, visits: [visit] }] });
    save.mockRejectedValueOnce({ driverError: { code: '23505' } });
    findOneByPlace.mockResolvedValueOnce(concurrent);
    expect((await service.generate('trip', request)).status).toBe('generated');
    expect(replace).toHaveBeenCalledWith('trip', [
      expect.objectContaining({ savedPlaceId: 'concurrent-place' }),
    ], 'ai', []);
  });

  it('cleans up new places when itinerary integrity reports a conflict', async () => {
    const { service, replace, remove, record, original } = setup();
    replace.mockResolvedValue({ status: 'conflict', conflicts: ['DUPLICATE_SLOT'], itinerary: original });
    expect((await service.generate('trip', request)).status).toBe('conflict');
    expect(remove).toHaveBeenCalledWith([expect.objectContaining({ id: 'place-1' })]);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('AI place-name guard', () => {
  it.each(['편의점 도시락 픽업', '편의점 도시락 픽업 및 야식 준비', '점심 식사', '기념품 구매', '주변 산책…', '호텔 체크인'])('identifies a generic activity: %s', (name) => {
    expect(isGenericActivityName(name)).toBe(true);
  });

  it.each(['세븐일레븐 시부야 마크시티점', '에펠탑', '츠키지 스시세이 본점'])('keeps a searchable proper place name: %s', (name) => {
    expect(isGenericActivityName(name)).toBe(false);
  });

  it('cleans only an AI-authored coordinate-less activity placeholder', () => {
    expect(isInvalidAiPlaceholderPlace({
      name: '편의점 도시락 픽업 및 야식 준비', note: 'AI 추천 · 야식 준비', latitude: null, longitude: null,
    })).toBe(true);
    expect(isInvalidAiPlaceholderPlace({
      name: '편의점 도시락 픽업 및 야식 준비', note: '사용자가 직접 적은 메모', latitude: null, longitude: null,
    })).toBe(false);
    expect(isInvalidAiPlaceholderPlace({
      name: '세븐일레븐 시부야 마크시티점', note: 'AI 추천 · 실제 지점', latitude: 35.65, longitude: 139.7,
    })).toBe(false);
  });
});

describe('AI-owned itinerary quality and diagnostics', () => {
  it('stores visits in chronological order even when the reviewed model output is reversed', async () => {
    const { service, generate, replace } = setup();
    generate.mockResolvedValue({ days: [{ date, visits: [
      { ...visit, placeName: '늦은 장소', startTime: '17:10' },
      { ...visit, placeName: '이른 장소', startTime: '14:00' },
      { ...visit, placeName: '중간 장소', startTime: '14:45' },
    ] }] });
    await service.generate('trip', request);
    expect((replace.mock.calls[0]![1] as StoredPlacement[]).map((item) => item.scheduledTime))
      .toEqual(['14:00', '14:45', '17:10']);
  });
  it('stores sparse, meal-only, wrong-region/type and out-of-hours results without a quality veto or timing rewrite', async () => {
    const { service, generate, replace } = setup();
    expect((await service.generate('trip', request)).status).toBe('generated');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('trip', [expect.objectContaining({
      scheduledTime: '23:00', durationMinutes: 30, activitySummary: visit.description,
    })], 'ai', []);
    const stored = replace.mock.calls[0]![1] as StoredPlacement[];
    expect(stored[0]).not.toHaveProperty('travelDurationMinutes');
  });

  it.each([{ days: [] }, { days: [{ date, visits: [] }] }])('logs empty output honestly without a server quality rejection: %j', async ({ days }) => {
    const { service, generate, trip, savedPlaces } = setup();
    trip.endDate = '2026-12-05';
    savedPlaces.push(place('hotel', null, true));
    generate.mockResolvedValue({ days });
    const log = vi.spyOn(logs, 'writeStructuredLog');
    try {
      expect((await service.generate('trip', request)).status).toBe('generated');
      expect(log).toHaveBeenCalledWith('info', 'ai.generation.completed', expect.objectContaining({
        receivedDayCount: days.length, receivedVisitCount: 0, savedVisitCount: 0, lodgingConnectionCount: 4,
      }));
    } finally { log.mockRestore(); }
  });

  it('logs received and saved real visit counts separately from hotel endpoints', async () => {
    const { service, trip, savedPlaces, generate } = setup();
    trip.endDate = '2026-12-05';
    savedPlaces.push(place('hotel', null, true));
    generate.mockResolvedValue({ days: [{ date, visits: [visit] }, { date: '2026-12-04', visits: [visit] }, { date: trip.endDate, visits: [] }] });
    const log = vi.spyOn(logs, 'writeStructuredLog');
    try {
      await service.generate('trip', request);
      expect(log).toHaveBeenCalledWith('info', 'ai.generation.output_received', expect.objectContaining({ receivedDayCount: 3, receivedVisitCount: 2 }));
      expect(log).toHaveBeenCalledWith('info', 'ai.generation.completed', expect.objectContaining({ savedVisitCount: 2, lodgingConnectionCount: 4 }));
    } finally { log.mockRestore(); }
  });

  it('preserves the old itinerary when initial model invocation fails', async () => {
    const { service, generate, replace, original } = setup();
    generate.mockRejectedValue(new AiPlannerError('incomplete', { issue: 'max_output_tokens' }));
    expect(await service.generate('trip', request)).toMatchObject({ status: 'unavailable', failureReason: 'incomplete', itinerary: original });
    expect(replace).not.toHaveBeenCalled();
  });

  it('limits a day update to the selected date and clears only that day’s legacy activities', async () => {
    const { service, replace, replaceDay, trip } = setup();
    trip.startDate = '2026-12-01'; trip.endDate = '2026-12-07';
    expect((await service.generate('trip', request, date)).status).toBe('generated');
    expect(replaceDay).toHaveBeenCalledWith('trip', date, expect.any(Array), 'ai', []);
    expect(replace).not.toHaveBeenCalled();
  });

  it('counts only the generation date when a day update returns the entire itinerary', async () => {
    const { service, trip, replaceDay } = setup();
    trip.startDate = '2026-12-01'; trip.endDate = '2026-12-07';
    replaceDay.mockResolvedValue({ status: 'updated', conflicts: [], itinerary: { items: [
      { savedPlaceId: 'other-day', date: '2026-12-02', position: 0 },
      { savedPlaceId: 'place-1', date, position: 0 },
    ], unplaced: [] } });
    const log = vi.spyOn(logs, 'writeStructuredLog');
    try {
      await service.generate('trip', request, date);
      expect(log).toHaveBeenCalledWith('info', 'ai.generation.completed', expect.objectContaining({
        receivedVisitCount: 1, savedVisitCount: 1, savedVisitsByDate: [{ date, visitCount: 1 }],
      }));
    } finally { log.mockRestore(); }
  });

  it('preserves visit durations when adding lodging endpoints', () => {
    expect(addLodgingEndpoints([{ savedPlaceId: 'a', date, position: 0, durationMinutes: 45 }], [{ date, startLodging: null, endLodging: null }])[0]!.durationMinutes).toBe(45);
  });
});

describe('travel preferences compatibility', () => {
  it('ignores stored legacy density when restoring settings or updating a day', async () => {
    const { service, generate } = setup({ ...request, density: 'busy' });
    expect((await service.getLatestRequest('trip')).request).not.toHaveProperty('density');
    await service.generateDay('trip', date);
    expect(generate.mock.calls[0]?.[0].preferences).toEqual({
      themes: request.themes, companions: request.companions, transportModes: request.transportModes,
      budgetLevel: request.budgetLevel, additionalRequests: request.additionalRequests,
    });
  });
  it('does not retain a legacy density when a queued request is saved again', async () => {
    const { service, saveTrip } = setup();
    const legacyRequest = { ...request, density: 'relaxed' };
    expect(await service.generate('trip', legacyRequest)).not.toHaveProperty('density');
    expect(saveTrip.mock.calls[0]?.[0]).toMatchObject({ latestAiPlanRequest: request });
    expect(saveTrip.mock.calls[0]?.[0]).not.toHaveProperty('latestAiPlanRequest.density');
  });
  it.each([undefined, date])('passes every current preference to the model for scope %s', async (targetDate) => {
    const { service, generate } = setup();
    const requested = { ...request, themes: [TravelTheme.Food, TravelTheme.Cafes, TravelTheme.Nature] };
    await service.generate('trip', requested, targetDate);
    expect(generate.mock.calls[0]?.[0].preferences).toEqual({
      themes: requested.themes, companions: requested.companions, transportModes: requested.transportModes,
      budgetLevel: requested.budgetLevel, additionalRequests: requested.additionalRequests,
    });
    expect(generate.mock.calls[0]?.[0].days.map((day) => day.date)).toEqual([date]);
  });
});
