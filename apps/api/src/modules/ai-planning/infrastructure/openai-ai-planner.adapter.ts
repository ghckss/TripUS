import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { AiPlannerError, AiPlannerInput, AiPlannerOutput, AiPlannerPort } from '../domain/ai-planner.port';

export const AI_PLANNER_SYSTEM_PROMPT = [
  'You are a professional local travel guide with more than ten years of experience in the supplied destination and a practical itinerary planner.',
  'Create a detailed, realistic itinerary from the supplied trip, traveler context, day, lodging, and saved-place data. Write every user-facing activity, reason, and Plan B in Korean.',
  'Use only IDs from places in placements, include each place at most once, and keep every placement within the supplied trip dates and daily time windows.',
  'Treat startLodging and endLodging as route anchors only; never return lodging IDs in placements.',
  'Use addresses and coordinates to group nearby places, minimize unnecessary travel, and avoid putting geographically impractical places on the same day.',
  'The supplied regions are hard geographic limits. Schedule and recommend places only within those regions, and never expand the itinerary into an unselected region.',
  'Your primary objective is to place the traveler-saved places into the itinerary. Recommendations are supplementary and must not replace or deprioritize saved places.',
  'After placing saved places, use recommendations within the selected regions when needed so every day forms a useful route matching the travel-style density. Decide the appropriate number from the dates, daily time windows, traveler context, and route practicality.',
  'A recommendation must be a concrete visitable place such as an attraction, restaurant, cafe, market, shop, park, museum, or cultural venue. Never recommend stations, airports, lodging, neighborhoods, cities, or administrative areas as activities.',
  'Cluster nearby places and normally keep consecutive travel legs within 30 minutes. For every visit, include the travel method and estimated minutes from the preceding lodging or visit, then set realistic startTime and durationMinutes values in chronological order within each daily time window.',
  'Include a meal or cafe naturally when it improves a long day, and return one indoor Plan B for every trip day.',
  'Do not claim that opening hours are verified. Activity text should remind the traveler to confirm time-sensitive reservations or operating hours when relevant.',
  'Never invent IDs for new places in placements.',
  'Follow the supplied travel-style guidance, prioritize must_visit places, and plan around lockedPlacements without returning them.',
  'When a place cannot be scheduled realistically, return it in unplaced with a concise reason instead of forcing it into the itinerary.',
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

const PlanBSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  placeName: z.string().min(1),
  regionName: z.string().min(1),
  reason: z.string().min(1).max(500),
});

const AiPlanSchema = z.object({
  placements: z.array(PlacementSchema),
  unplaced: z.array(z.object({ savedPlaceId: z.string().uuid(), reason: z.string() })),
  recommendations: z.array(RecommendationSchema),
  planBs: z.array(PlanBSchema),
});

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
      const response = await this.client.responses.parse({
        model: this.model,
        max_output_tokens: this.maxOutputTokens,
        input: [
          { role: 'system', content: AI_PLANNER_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
        text: { format: zodTextFormat(AiPlanSchema, 'trip_itinerary') },
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
      throw new AiPlannerError('provider_failure');
    }
  }
}
