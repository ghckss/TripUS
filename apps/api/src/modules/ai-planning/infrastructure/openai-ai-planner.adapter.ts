import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { writeStructuredLog } from '../../../common/http/json-logger';
import {
  AiPlannerError,
  AiPlannerInput,
  AiPlannerOutput,
  AiPlannerPort,
} from '../domain/ai-planner.port';

import {
  AI_PLANNER_PROMPT_VERSION,
  AI_PLANNER_REVIEW_SYSTEM_PROMPT,
  buildPlannerSystemPrompt,
  buildPlannerUserInput,
  requestedDailyTimeWindow,
  type RequestedDailyTimeWindow,
} from './ai-planner-prompts';
export { AI_PLANNER_SYSTEM_PROMPT } from './ai-planner-prompts';

/** Restrict references and dates, without judging visit counts or itinerary quality. */
function allowedStartTimes(window: RequestedDailyTimeWindow): [string, ...string[]] {
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const values: string[] = [];
  for (let minute = minutes(window.startTime); minute < minutes(window.endTime); minute += 1) {
    values.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
  }
  return values as [string, ...string[]];
}

export function constrainAiPlanToTimeWindow(output: AiPlannerOutput, window?: RequestedDailyTimeWindow): AiPlannerOutput {
  if (!window) return output;
  const endMinutes = Number(window.endTime.slice(0, 2)) * 60 + Number(window.endTime.slice(3, 5));
  return {
    ...output,
    days: output.days.map((day) => ({
      ...day,
      visits: day.visits.map((visit) => {
        const startMinutes = Number(visit.startTime.slice(0, 2)) * 60 + Number(visit.startTime.slice(3, 5));
        return { ...visit, durationMinutes: Math.min(visit.durationMinutes, Math.max(0, endMinutes - startMinutes)) };
      }),
    })),
  };
}

export function createAiPlanSchema(allowedPlaceIds: string[], itineraryDates: string[], timeWindow?: RequestedDailyTimeWindow) {
  const savedPlaceId = allowedPlaceIds.length > 0
    ? z.enum(allowedPlaceIds as [string, ...string[]]).nullable()
    : z.null();
  const date = itineraryDates.length > 0
    ? z.enum(itineraryDates as [string, ...string[]])
    : z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const visit = z.strictObject({
    savedPlaceId,
    placeName: z.string().min(1),
    regionName: z.string().min(1),
    startTime: timeWindow ? z.enum(allowedStartTimes(timeWindow)) : z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationMinutes: z.number().int().min(0),
    description: z.string().min(1).max(500),
    mealType: z.enum(['breakfast', 'lunch', 'dinner']).nullable(),
  });
  return z.strictObject({
    days: z.array(z.strictObject({ date, visits: z.array(visit) })),
  });
}

@Injectable()
export class OpenAiPlannerAdapter implements AiPlannerPort {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxOutputTokens: number;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.timeoutMs = config.getOrThrow<number>('OPENAI_TIMEOUT_MS');
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
      timeout: config.getOrThrow<number>('OPENAI_TIMEOUT_MS'),
      maxRetries: config.getOrThrow<number>('OPENAI_MAX_RETRIES'),
    });
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
    this.maxOutputTokens = config.getOrThrow<number>('OPENAI_MAX_OUTPUT_TOKENS');
    writeStructuredLog('info', 'ai.planner.config', { model: this.model, timeoutMs: this.timeoutMs, maxOutputTokens: this.maxOutputTokens, maxRetries: this.client.maxRetries, streaming: true });
  }

  async generate(input: AiPlannerInput, context?: { generationId: string; tripId: string }): Promise<AiPlannerOutput> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), this.timeoutMs);
    let responseId: string | undefined;
    let phase = 'connecting';
    let lastEventAt = startedAt;
    let lastProgressLogAt = 0;
    let completedSearches = 0;
    try {
      const timeWindow = requestedDailyTimeWindow(input.preferences.additionalRequests);
      const schema = createAiPlanSchema(
        input.places.map((place) => place.id),
        input.days.map((day) => day.date),
        timeWindow,
      );
      const request = buildPlannerUserInput(input);
      const runPass = async (
        pass: 'generate' | 'review',
        messages: Array<{ role: 'system' | 'user'; content: string }>,
      ): Promise<AiPlannerOutput> => {
        writeStructuredLog('info', 'ai.planner.prompt', {
          ...context, version: AI_PLANNER_PROMPT_VERSION, model: this.model,
          timeoutMs: this.timeoutMs, maxOutputTokens: this.maxOutputTokens, phase: pass,
        });
        const stream = this.client.responses.stream({
          model: this.model,
          max_output_tokens: this.maxOutputTokens,
          tools: [{ type: 'web_search', external_web_access: true, user_location: { type: 'approximate' } }],
          tool_choice: 'required',
          include: ['web_search_call.action.sources'],
          input: messages,
          text: { format: zodTextFormat(schema, 'trip_itinerary') },
        }, { signal: controller.signal });
        stream.on('event', (event) => {
          lastEventAt = Date.now();
          const previousPhase = phase;
          const passPhase = (value: string) => pass === 'generate' ? value : `review_${value}`;
          if (event.type === 'response.created') responseId = event.response.id;
          if (event.type === 'response.in_progress') phase = passPhase('planning');
          if (event.type.startsWith('response.web_search_call.')) phase = passPhase('web_search');
          if (event.type === 'response.web_search_call.completed') completedSearches += 1;
          if (event.type === 'response.output_text.delta') phase = passPhase('writing');
          if (event.type === 'response.completed') phase = passPhase('completed');
          if (phase !== previousPhase || event.type === 'response.web_search_call.completed' || lastEventAt - lastProgressLogAt >= 15_000) {
            lastProgressLogAt = lastEventAt;
            writeStructuredLog('info', 'ai.planner.progress', {
              ...context, responseId, model: this.model, phase, pass, streamEvent: event.type,
              elapsedMs: lastEventAt - startedAt, completedSearches,
            });
          }
        });
        const response = await stream.finalResponse();
        writeStructuredLog('info', 'ai.planner.web_search', {
          ...context, responseId, pass,
          calls: response.output.filter((item) => item.type === 'web_search_call').length,
        });
        writeStructuredLog('info', 'ai.planner.response', {
          ...context, responseId, pass, status: response.status, maxOutputTokens: this.maxOutputTokens,
          usage: response.usage, incompleteDetails: response.incomplete_details,
        });
        if (response.status === 'incomplete') throw new AiPlannerError(
          response.incomplete_details?.reason === 'max_output_tokens' ? 'output_limit' : 'incomplete',
          { responseId, pass, maxOutputTokens: this.maxOutputTokens, usage: response.usage, incompleteDetails: response.incomplete_details },
        );
        if (response.status === 'failed') throw new AiPlannerError('provider_failure', { responseId, pass, providerError: response.error });
        if (response.output.some((item) => item.type === 'message' && item.content.some((content) => content.type === 'refusal'))) {
          throw new AiPlannerError('refused', { responseId, pass });
        }
        if (!response.output_parsed) throw new AiPlannerError('invalid_output', { responseId, pass });
        return constrainAiPlanToTimeWindow({
          ...response.output_parsed,
          usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
        }, timeWindow);
      };

      const draft = await runPass('generate', [
        { role: 'system', content: buildPlannerSystemPrompt() },
        { role: 'user', content: JSON.stringify(request) },
      ]);
      try {
        const reviewed = await runPass('review', [
          { role: 'system', content: AI_PLANNER_REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ request, draft: { days: draft.days } }) },
        ]);
        return {
          ...reviewed,
          usage: {
            inputTokens: (draft.usage?.inputTokens ?? 0) + (reviewed.usage?.inputTokens ?? 0),
            outputTokens: (draft.usage?.outputTokens ?? 0) + (reviewed.usage?.outputTokens ?? 0),
          },
        };
      } catch (reviewError) {
        writeStructuredLog('warn', 'ai.planner.review_fallback', {
          ...context,
          reason: reviewError instanceof AiPlannerError ? reviewError.reason : 'provider_failure',
          errorName: reviewError instanceof Error ? reviewError.name : typeof reviewError,
        });
        return draft;
      }
    } catch (error) {
      if (error instanceof AiPlannerError) throw error;
      const timedOut = controller.signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError;
      const details = {
        ...context, ...providerErrorDetails(error), responseId, model: this.model, phase,
        timeoutMs: this.timeoutMs, elapsedMs: Date.now() - startedAt,
        lastEventAgoMs: Date.now() - lastEventAt, completedSearches,
      };
      writeStructuredLog('error', 'ai.planner.provider_failure', details);
      throw new AiPlannerError(timedOut ? 'timeout' : 'provider_failure', details);
    } finally {
      clearTimeout(deadline);
    }
  }

}

function providerErrorDetails(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') return { errorType: typeof error };
  const candidate = error as Record<string, unknown>;
  return {
    errorName: typeof candidate.name === 'string' ? candidate.name : error.constructor?.name,
    errorMessage: typeof candidate.message === 'string' ? candidate.message.slice(0, 500) : undefined,
    statusCode: typeof candidate.status === 'number' ? candidate.status : undefined,
    errorCode: typeof candidate.code === 'string' ? candidate.code : undefined,
    errorType: typeof candidate.type === 'string' ? candidate.type : undefined,
    providerRequestId: typeof candidate.request_id === 'string'
      ? candidate.request_id
      : typeof candidate.requestId === 'string' ? candidate.requestId : undefined,
  };
}
