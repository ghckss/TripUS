import { Injectable } from '@nestjs/common';

import { AiPlannerInput, AiPlannerOutput, AiPlannerPort } from '../domain/ai-planner.port';

@Injectable()
export class MockAiPlannerAdapter implements AiPlannerPort {
  generate(input: AiPlannerInput): Promise<AiPlannerOutput> {
    const ranked = [...input.places].sort((a, b) => preferenceScore(b.preference) - preferenceScore(a.preference));
    const days: AiPlannerOutput['days'] = input.days.map(({ date }) => ({ date, visits: [] }));
    ranked.forEach((place, index) => {
      const day = days[index % days.length];
      if (!day) return;
      day.visits.push({
        savedPlaceId: place.id,
        placeName: place.name,
        regionName: input.trip.regions[0]?.name ?? input.trip.destination,
        startTime: `${String(9 + day.visits.length * 2).padStart(2, '0')}:00`,
        durationMinutes: 90,
        description: `${place.name}에서 여행지의 매력을 경험할 수 있어요.`,
        mealType: null,
      });
    });
    return Promise.resolve({ days });
  }
}

function preferenceScore(preference: string): number {
  return preference === 'must_visit' ? 2 : preference === 'want_to_visit' ? 1 : 0;
}
