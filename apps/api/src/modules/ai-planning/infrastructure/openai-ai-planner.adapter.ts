import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { writeStructuredLog } from '../../../common/http/json-logger';
import { AiPlannerError, AiPlannerInput, AiPlannerOutput, AiPlannerPort } from '../domain/ai-planner.port';

export const AI_PLANNER_SYSTEM_PROMPT = [
  'You are a professional local travel guide with more than ten years of experience in the supplied destination and a practical itinerary planner.',
  'Create a detailed, realistic itinerary from the supplied trip, traveler context, day, lodging, and saved-place data. Write every user-facing activity and reason in Korean.',
  'Use only IDs from places in placements, include each place at most once, and keep every placement within the supplied trip dates.',
  'Treat startLodging and endLodging as route anchors only; never return lodging IDs in placements.',
  'Use addresses and coordinates to group nearby places, minimize unnecessary travel, and avoid putting geographically impractical places on the same day.',
  'The supplied regions are hard geographic limits for recommendations, except for nearby route-supporting recommendations around a traveler-saved place outside those regions. Saved places in places are explicit exceptions even when their address or coordinates are outside the selected regions.',
  'Place every traveler-saved place exactly once in placements. Never omit it, replace it with a recommendation, or return it in unplaced merely because it is outside the selected regions.',
  'Treat an out-of-region saved place as an intentional route anchor. Group nearby saved places on the same practical day and add only route-supporting recommendations near that anchor when needed.',
  'If the places array is empty, recommendations are the complete itinerary: choose and schedule all necessary attractions, meals, cafes, shops, or activities inside the selected regions.',
  'Lodging is optional. If startLodging or endLodging is null, begin with the first visit or finish with the last visit and never invent a lodging.',
  'When trip.startPoint is provided, begin the first date from that fixed place and do not schedule a visit before its time. When trip.endPoint is provided, finish the final date at that fixed place by its time. Include travel between each boundary point and the nearest visit in the route reasoning.',
  'After placing saved places, use recommendations within the selected regions so visits, travel, meals, and reasonable breaks form a complete day. Do not use a fixed place count and do not stop after only one or two short visits when the route can reasonably include more.',
  'Places in priorRecommendations are optional suggestions from an older AI itinerary, not traveler-required places. You may recommend one again when it remains the best choice, but prefer a better alternative when the new route or context supports it.',
  'A recommendation must be a concrete visitable place such as an attraction, restaurant, cafe, market, shop, park, museum, or cultural venue. Never recommend stations, airports, lodging, neighborhoods, cities, or administrative areas as activities.',
  'Cluster nearby places and normally keep consecutive travel legs within 30 minutes. For every visit, include the travel method and estimated minutes from the preceding lodging or visit, then set realistic startTime and durationMinutes values in chronological order for that date.',
  'Include meals or cafes naturally when they help form a complete day.',
  'Do not claim that opening hours are verified. Activity text should remind the traveler to confirm time-sensitive reservations or operating hours when relevant.',
  'Never invent IDs for new places in placements.',
  'Follow the supplied travel-style guidance, prioritize must_visit places, and plan around lockedPlacements without returning them.',
  'The minimum daily duration in the travel-style guidance is the sum of durationMinutes and travelDurationMinutes for that date; it is not a required start or end time.',
  'Each day.targetPlannedMinutes overrides the full-day minimum in the travel-style guidance. It already accounts for a late arrival or early departure and must be respected instead of forcing a full-day schedule.',
  'Use unplaced only for a genuinely impossible traveler-saved place after considering every trip date, boundary time, and route grouping. A different city or a longer day trip is not by itself a valid reason.',
  'Do not invent place IDs, locations, dates, or opening hours.',
].join(' ');

const PlacementSchema = z.object({
  savedPlaceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  position: z.number().int().min(0),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(15).max(360),
  activity: z.string().min(1).max(500),
  travelMethod: z.string().min(1).max(120),
  travelDurationMinutes: z.number().int().min(0).max(180),
});

const RecommendationSchema = z.object({
  placeName: z.string().min(1),
  regionName: z.string().min(1),
  suggestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  position: z.number().int().min(0),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(15).max(360),
  activity: z.string().min(1).max(500),
  travelMethod: z.string().min(1).max(120),
  travelDurationMinutes: z.number().int().min(0).max(180),
  reason: z.string().min(1),
});

export function createAiPlanSchema(allowedPlaceIds: string[]) {
  const allowedId = allowedPlaceIds.length > 0
    ? z.enum(allowedPlaceIds as [string, ...string[]])
    : z.string().uuid();
  const placements = allowedPlaceIds.length === 0
    ? z.array(PlacementSchema).max(0)
    : z.array(PlacementSchema.extend({
      savedPlaceId: allowedId,
    }));
  const unplacedItem = z.object({ savedPlaceId: allowedId, reason: z.string() });
  return z.object({
    placements,
    unplaced: allowedPlaceIds.length === 0
      ? z.array(unplacedItem).max(0)
      : z.array(unplacedItem),
    recommendations: allowedPlaceIds.length === 0
      ? z.array(RecommendationSchema).min(1)
      : z.array(RecommendationSchema),
  });
}

@Injectable()
export class OpenAiPlannerAdapter implements AiPlannerPort {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxOutputTokens: number;

  constructor(config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
      timeout: config.getOrThrow<number>('OPENAI_TIMEOUT_MS'),
      maxRetries: config.getOrThrow<number>('OPENAI_MAX_RETRIES'),
    });
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
    this.maxOutputTokens = config.getOrThrow<number>('OPENAI_MAX_OUTPUT_TOKENS');
  }

  async generate(input: AiPlannerInput): Promise<AiPlannerOutput> {
    try {
      const schema = createAiPlanSchema(input.places.map((place) => place.id));
      const response = await this.client.responses.parse({
        model: this.model,
        max_output_tokens: this.maxOutputTokens,
        input: [
          { role: 'system', content: AI_PLANNER_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
        text: { format: zodTextFormat(schema, 'trip_itinerary') },
      });
      if (response.status === 'incomplete') throw new AiPlannerError('incomplete');
      if (response.output.some((item) => item.type === 'message' && item.content.some((content) => content.type === 'refusal'))) {
        throw new AiPlannerError('refused');
      }
      if (!response.output_parsed) throw new AiPlannerError('invalid_output');
      return {
        ...response.output_parsed,
        usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
      };
    } catch (error) {
      if (error instanceof AiPlannerError) throw error;
      const details = providerErrorDetails(error);
      writeStructuredLog('error', 'ai.planner.provider_failure', details);
      throw new AiPlannerError('provider_failure', details);
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
