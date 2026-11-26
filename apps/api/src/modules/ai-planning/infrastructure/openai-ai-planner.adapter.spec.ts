import { describe, expect, it, vi } from 'vitest';

import { TravelTheme, type AiPlannerInput } from '../domain/ai-planner.port';
import { ConfigService } from '@nestjs/config';
import { constrainAiPlanToTimeWindow, createAiPlanSchema, OpenAiPlannerAdapter } from './openai-ai-planner.adapter';

const date = '2026-11-08';
const savedPlaceId = '30000000-0000-4000-8000-000000000001';
const visit = {
  savedPlaceId: null, placeName: '서울숲', regionName: '서울특별시',
  startTime: '09:00', durationMinutes: 120, description: '계절별 숲과 정원', mealType: null,
};

describe('day visit response schema', () => {
  it('supports mixed registered and new places in a single ordered day', () => {
    const output = { days: [{ date, visits: [{ ...visit, savedPlaceId }, visit] }] };
    expect(createAiPlanSchema([savedPlaceId], [date]).parse(output)).toEqual(output);
  });
  it('supports new visits without registered places or arrays forced empty', () => {
    const schema = createAiPlanSchema([], [date]);
    expect(schema.safeParse({ days: [{ date, visits: [visit] }] }).success).toBe(true);
    expect(schema.safeParse({ days: [{ date, visits: [{ ...visit, savedPlaceId }] }] }).success).toBe(false);
  });
  it('restricts saved place IDs and dates to supplied references', () => {
    const schema = createAiPlanSchema(['30000000-0000-4000-8000-000000000002'], [date]);
    expect(schema.safeParse({ days: [{ date, visits: [{ ...visit, savedPlaceId }] }] }).success).toBe(false);
    expect(schema.safeParse({ days: [{ date: '2026-11-09', visits: [visit] }] }).success).toBe(false);
  });
  it('does not judge visit counts, sparse output or long dwell times', () => {
    const schema = createAiPlanSchema([], [date]);
    expect(schema.safeParse({ days: [] }).success).toBe(true);
    expect(schema.safeParse({ days: [{ date, visits: [] }] }).success).toBe(true);
    expect(schema.safeParse({ days: [{ date, visits: [{ ...visit, durationMinutes: 480 }] }] }).success).toBe(true);
  });
  it('does not accept retired lists, reason, transport fields or arbitrary activities', () => {
    const schema = createAiPlanSchema([], [date]);
    expect(schema.safeParse({ days: [], placements: [], recommendations: [] }).success).toBe(false);
    for (const extra of [{ reason: '추천 근거' }, { travelDurationMinutes: 10 }, { type: 'transport' }]) {
      expect(schema.safeParse({ days: [{ date, visits: [{ ...visit, ...extra }] }] }).success).toBe(false);
    }
  });
  it('restricts every visit start to an explicitly requested daily time range', () => {
    const schema = createAiPlanSchema([], [date], { startTime: '14:00', endTime: '18:00' });
    expect(schema.safeParse({ days: [{ date, visits: [{ ...visit, startTime: '14:00' }, { ...visit, startTime: '17:59' }] }] }).success).toBe(true);
    expect(schema.safeParse({ days: [{ date, visits: [{ ...visit, startTime: '09:00' }] }] }).success).toBe(false);
    expect(schema.safeParse({ days: [{ date, visits: [{ ...visit, startTime: '18:00' }] }] }).success).toBe(false);
  });
  it('caps the final dwell time so a visit cannot finish after the requested range', () => {
    const output = { days: [{ date, visits: [{ ...visit, startTime: '17:30', durationMinutes: 90 }] }] };
    expect(constrainAiPlanToTimeWindow(output, { startTime: '14:00', endTime: '18:00' }).days[0]?.visits[0])
      .toMatchObject({ startTime: '17:30', durationMinutes: 30 });
  });
});

const plannerInput: AiPlannerInput = {
  preferences: {
    themes: [TravelTheme.Food, TravelTheme.Cafes], companions: '친구 2명',
    transportModes: ['public_transit', 'walking'], budgetLevel: 'standard',
    additionalRequests: '야경은 저녁에 보고 싶어요.',
  },
  trip: { title: 'Paris', destination: '프랑스', regions: [], timezone: 'Europe/Paris', startDate: '2026-12-01', endDate: '2026-12-07', startPoint: null, endPoint: null, lodgings: [] },
  places: [], days: [],
};
function streamingFixture() {
  const adapter = new OpenAiPlannerAdapter(new ConfigService({
    OPENAI_API_KEY: 'test-key', OPENAI_TIMEOUT_MS: 1000, OPENAI_MAX_RETRIES: 0,
    OPENAI_MODEL: 'gpt-4.1-mini', OPENAI_MAX_OUTPUT_TOKENS: 20000,
  }));
  const client = (adapter as unknown as { client: { responses: { stream: (...args: unknown[]) => unknown } } }).client;
  const on = vi.fn();
  const finalResponse = vi.fn().mockResolvedValue({
    status: 'completed', output: [{ type: 'web_search_call' }],
    output_parsed: { days: [] }, usage: { input_tokens: 10, output_tokens: 20 },
  });
  const stream = vi.spyOn(client.responses, 'stream').mockReturnValue({ on, finalResponse });
  return { adapter, stream, on, finalResponse };
}

describe('web-backed streaming generation', () => {
  it('requires live search and JSON output with a shared cancellation deadline', async () => {
    const { adapter, stream } = streamingFixture();
    expect(await adapter.generate(plannerInput)).toMatchObject({ usage: { inputTokens: 20, outputTokens: 40 } });
    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream.mock.calls[0]?.[0]).toMatchObject({
      tools: [{ type: 'web_search', external_web_access: true, user_location: { type: 'approximate' } }],
      tool_choice: 'required', include: ['web_search_call.action.sources'],
      text: { format: { type: 'json_schema' } },
    });
    const { input: messages } = stream.mock.calls[0]?.[0] as { input: Array<{ role: string; content: string }> };
    const payload: unknown = JSON.parse(messages.find((message) => message.role === 'user')!.content);
    expect(payload).toMatchObject({ preferences: plannerInput.preferences });
    const { input: reviewMessages } = stream.mock.calls[1]?.[0] as { input: Array<{ role: string; content: string }> };
    const reviewPayload: unknown = JSON.parse(reviewMessages.find((message) => message.role === 'user')!.content);
    expect(reviewPayload).toMatchObject({ request: { preferences: plannerInput.preferences }, draft: { days: [] } });
    expect(reviewMessages.find((message) => message.role === 'system')?.content).toContain('여행 일정의 최종 검토자');
    expect(reviewMessages.find((message) => message.role === 'system')?.content).toContain('해당 여행 연도·월의 공식 달력');
    const { text } = stream.mock.calls[0]?.[0] as { text: { format: { schema: unknown } } };
    expect(JSON.stringify(text.format.schema)).not.toMatch(/"(reason|activities|placements|recommendations|unplaced|savedRecommendations|placeDescriptions|position|travelMethod|travelDurationMinutes)"/);
    expect(JSON.stringify(text.format.schema)).not.toMatch(/minItems|maxItems/);
    expect(text.format.schema).toMatchObject({ properties: { days: { type: 'array' } }, required: ['days'] });
    expect((stream.mock.calls[0]?.[1] as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
    expect((stream.mock.calls[1]?.[1] as { signal: AbortSignal }).signal).toBe((stream.mock.calls[0]?.[1] as { signal: AbortSignal }).signal);
  });

  it('keeps the usable draft when the final review pass fails', async () => {
    const { adapter, stream, finalResponse } = streamingFixture();
    finalResponse
      .mockResolvedValueOnce({
        status: 'completed', output: [{ type: 'web_search_call' }],
        output_parsed: { days: [{ date, visits: [visit] }] }, usage: { input_tokens: 10, output_tokens: 20 },
      })
      .mockRejectedValueOnce(new Error('review unavailable'));

    await expect(adapter.generate(plannerInput)).resolves.toMatchObject({
      days: [{ date, visits: [visit] }], usage: { inputTokens: 10, outputTokens: 20 },
    });
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it('aborts at the total deadline and preserves the last known search progress in timeout details', async () => {
    vi.useFakeTimers();
    try {
      const { adapter, stream, on, finalResponse } = streamingFixture();
      finalResponse.mockImplementation(() => {
        const listener = on.mock.calls[0]![1] as (event: unknown) => void;
        listener({ type: 'response.created', response: { id: 'response-test' } });
        listener({ type: 'response.web_search_call.completed' });
        const { signal } = stream.mock.calls[0]![1] as { signal: AbortSignal };
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
      });
      const assertion = expect(adapter.generate(plannerInput)).rejects.toMatchObject({
        reason: 'timeout', details: { responseId: 'response-test', phase: 'web_search', timeoutMs: 1000, elapsedMs: 1000, completedSearches: 1 },
      });
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
      expect(stream).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('distinguishes output exhaustion from timeout and retains token usage', async () => {
    const { adapter, finalResponse } = streamingFixture();
    finalResponse.mockResolvedValue({ status: 'incomplete', output: [], incomplete_details: { reason: 'max_output_tokens' }, usage: { input_tokens: 100, output_tokens: 20000 } });
    await expect(adapter.generate(plannerInput)).rejects.toMatchObject({ reason: 'output_limit', details: { maxOutputTokens: 20000, usage: { output_tokens: 20000 } } });
  });

  it('keeps provider errors distinct from timeout and clears the deadline', async () => {
    const { adapter, finalResponse } = streamingFixture();
    finalResponse.mockRejectedValue(new Error('connection lost'));
    await expect(adapter.generate(plannerInput)).rejects.toMatchObject({ reason: 'provider_failure', details: { phase: 'connecting' } });
  });
});
