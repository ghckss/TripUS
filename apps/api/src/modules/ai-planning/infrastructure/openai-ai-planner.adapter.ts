import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { AiPlannerInput, AiPlannerOutput, AiPlannerPort } from '../domain/ai-planner.port';

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

  constructor(config: ConfigService) {
    this.client = new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
  }

  async generate(input: AiPlannerInput): Promise<AiPlannerOutput> {
    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        { role: 'system', content: 'You create practical travel itineraries. Use only supplied savedPlaceId values, include each at most once, and keep every placement within the supplied trip dates.' },
        { role: 'user', content: JSON.stringify(input) },
      ],
      text: { format: zodTextFormat(AiPlanSchema, 'trip_itinerary') },
    });
    if (!response.output_parsed) {
      throw new ServiceUnavailableException('AI planner did not return a usable itinerary');
    }
    return response.output_parsed;
  }
}
