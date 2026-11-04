import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { AiPlannerError, AiPlannerInput, AiPlannerOutput, AiPlannerPort } from '../domain/ai-planner.port';

const AiPlanSchema = z.object({
  placements: z.array(z.object({
    savedPlaceId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    position: z.number().int().min(0),
  })),
  unplaced: z.array(z.object({ savedPlaceId: z.string().uuid(), reason: z.string() })),
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
          { role: 'system', content: 'You create practical travel itineraries. Use only supplied savedPlaceId values, include each at most once, keep every placement within the supplied trip dates, respect each day setting, lodging start/end point, and available time window, and plan around lockedPlacements without returning them.' },
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
