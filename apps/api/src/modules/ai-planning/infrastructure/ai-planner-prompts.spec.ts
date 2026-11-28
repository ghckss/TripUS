import { describe, expect, it } from 'vitest';
import type { AiPlannerInput } from '../domain/ai-planner.port';
import { AI_PLANNER_REVIEW_SYSTEM_PROMPT, buildPlannerSystemPrompt, buildPlannerUserInput, requestedDailyTimeWindow } from './ai-planner-prompts';

const input: AiPlannerInput = {
  additionalRequests: '몽생미셸 투어를 포함하고 루브르는 오전에 방문',
  trip: {
    title: '유럽 여행', destination: '프랑스', regions: [{ name: '파리', address: null, latitude: 48.85, longitude: 2.35 }],
    timezone: 'Europe/Paris', startDate: '2026-12-01', endDate: '2026-12-07',
    startPoint: { name: 'CDG', address: 'Paris', latitude: 49, longitude: 2.5, time: '12:00' },
    endPoint: { name: 'CDG', address: 'Paris', latitude: 49, longitude: 2.5, time: '15:00' },
    lodgings: [{ savedPlaceId: 'hotel', name: '숙소', address: 'Paris', latitude: 48.8, longitude: 2.3 }],
  },
  places: [{ id: 'museum', name: '루브르', address: 'Paris', latitude: 48.86, longitude: 2.33, tag: 'sight', preference: 'must_visit', note: '오전 관람' }],
  days: [{ date: '2026-12-03', startLodging: null, endLodging: null }],
};

describe('travel brief and selected preferences', () => {
  it('sends duration, destination, lodging, boundaries and complete saved-place details', () => {
    expect(buildPlannerUserInput(input)).toEqual({
      trip: { ...input.trip, startPoint: undefined, endPoint: undefined, lodgings: undefined, nights: 6, days: 7, startTimeMeaning: 'ready_to_travel', endTimeMeaning: 'arrival_at_end_point' },
      additionalRequests: input.additionalRequests,
      lodgings: input.trip.lodgings, startPoint: input.trip.startPoint, endPoint: input.trip.endPoint,
      places: input.places, itineraryDates: ['2026-12-03'], dayLodgings: input.days,
    });
  });

  it.each([['2026-12-01', '2026-12-01', 0, 1], ['2026-03-28', '2026-03-30', 2, 3]])('counts calendar days for %s to %s', (startDate, endDate, nights, days) => {
    expect(buildPlannerUserInput({ ...input, trip: { ...input.trip, startDate, endDate } }).trip).toMatchObject({ nights, days });
  });

  it('passes only additional requests as user personalization', () => {
    expect(buildPlannerUserInput(input).additionalRequests).toBe(input.additionalRequests);
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).not.toMatch(/preferences|themes|companions|transportModes|budgetLevel/);
    expect(prompt).toContain('additionalRequests');
    expect(prompt).toContain('투어 약칭이나 여러 장소를 뜻하는 표현은 웹 검색');
    expect(prompt).toContain('공휴일 대체 휴관');
    expect(AI_PLANNER_REVIEW_SYSTEM_PROMPT).toContain('해당 여행 연도·월의 공식 달력');
    expect(AI_PLANNER_REVIEW_SYSTEM_PROMPT).toContain('최대 도보 시간');
    expect(AI_PLANNER_REVIEW_SYSTEM_PROMPT).not.toMatch(/preferences|themes|companions|transportModes|budgetLevel/);
  });

  it.each([
    ['14~18시 사이에만 여행', { startTime: '14:00', endTime: '18:00' }],
    ['오후 2시부터 오후 6시까지 관광', { startTime: '14:00', endTime: '18:00' }],
    ['10:30시~16:45시 일정', { startTime: '10:30', endTime: '16:45' }],
  ])('structures an explicit user time range: %s', (additionalRequests, expected) => {
    expect(requestedDailyTimeWindow(additionalRequests)).toEqual(expected);
    expect(buildPlannerUserInput({ ...input, additionalRequests }))
      .toMatchObject({ additionalRequests, dailyTimeWindow: expected });
  });

  it('does not interpret unrelated numeric ranges as a daily time window', () => {
    expect(requestedDailyTimeWindow('도보 10분 이내, 여행 1~5일 전 준비')).toBeUndefined();
  });

  it('treats boundaries as ready-to-start and arrival times without adding airport procedures', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('필요한 수속을 마치고');
    expect(prompt).toContain('종료 장소에 도착해야 하는 목표 시각');
    expect(prompt).toContain('수속 여유를 다시 빼지 마세요');
    expect(prompt).not.toContain('arrival(입국 심사 및 수하물 수령) →');
    expect(prompt).toContain('장소의 특징·볼거리·매력');
    expect(prompt).toContain('편의점 도시락 픽업');
    expect(prompt).toContain('dailyTimeWindow');
    expect(AI_PLANNER_REVIEW_SYSTEM_PROMPT).toContain('모든 visit의 시작과 종료가 범위 안인지');
    expect(AI_PLANNER_REVIEW_SYSTEM_PROMPT).toContain('실제 업장·시설 고유명칭');
  });

  it('does not invent breaks, waiting, hotel stays or model route fields', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('사용자가 요청하지 않은 휴식·대기·자유시간·공백 채우기 활동을 생성하거나');
    expect(prompt).toContain('호텔 내부 식사는 생성하지 마세요');
    expect(prompt).toContain('이동 활동이나 이동시간 필드를 만들지 마세요');
    expect(prompt).not.toContain('check_in 또는 luggage');
  });

  it('scopes a day update to itineraryDates even when the trip spans a full week', () => {
    const payload = buildPlannerUserInput(input);
    expect(payload.trip.days).toBe(7);
    expect(payload.itineraryDates).toEqual(['2026-12-03']);
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('itineraryDates가 하루라면 그 하루만 반환하세요');
    expect(prompt).toContain('days에는 itineraryDates의 각 날짜를 날짜순으로');
    expect(prompt).toContain('startPoint는 trip.startDate에만, endPoint는 trip.endDate에만');
    expect(prompt).toContain('중간 날짜에는 여행 첫날의 시작 시각을 적용하지 마세요');
    expect(prompt).not.toContain('전체 여행 기간의 모든 날짜에 대한 일정을 반환하세요');
    expect(prompt).not.toContain('모든 여행 날짜에 대해');
  });

  it('maps input place IDs to savedPlaceId references without changing the input format', () => {
    expect(buildPlannerUserInput(input).places[0]).toMatchObject({ id: 'museum' });
    expect(buildPlannerUserInput(input).places[0]).not.toHaveProperty('savedPlaceId');
    expect(buildPlannerSystemPrompt()).toContain('places[].id를 savedPlaceId에 그대로 사용');
    expect(buildPlannerSystemPrompt()).toContain('새 장소의 savedPlaceId는 null');
  });

  it('handles missing places and boundaries without adding legacy rules or context', () => {
    const payload = buildPlannerUserInput({ ...input, trip: { ...input.trip, lodgings: [], startPoint: null, endPoint: null }, places: [], density: 'busy', travelerContext: { additionalRequests: 'legacy' } } as AiPlannerInput);
    expect(payload).toMatchObject({ lodgings: [], places: [], startPoint: null, endPoint: null });
    expect(Object.keys(payload)).toEqual(['trip', 'additionalRequests', 'lodgings', 'startPoint', 'endPoint', 'places', 'itineraryDates', 'dayLodgings']);
    expect(JSON.stringify(payload)).not.toMatch(/legacy|travelerContext|review|density|dailySightseeingTarget/);
    expect(buildPlannerSystemPrompt()).toContain('웹 검색은');
    expect(buildPlannerSystemPrompt()).toContain('확인 가능한 대안으로 바꾸어 시간표를 이어서 완성');
    expect(buildPlannerSystemPrompt()).not.toMatch(/placements|recommendations|savedRecommendations|unplaced|placeDescriptions|activities/);
  });
});
