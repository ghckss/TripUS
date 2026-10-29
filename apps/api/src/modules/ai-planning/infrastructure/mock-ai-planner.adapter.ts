import { Injectable } from '@nestjs/common';

import { AiPlannerInput, AiPlannerOutput, AiPlannerPort, TravelStyle } from '../domain/ai-planner.port';

@Injectable()
export class MockAiPlannerAdapter implements AiPlannerPort {
  generate(input: AiPlannerInput): Promise<AiPlannerOutput> {
    const dates = enumerateDates(input.startDate, input.endDate);
    const perDay = input.style === TravelStyle.Relaxed ? 2 : 3;
    const capacity = dates.length * perDay;
    const ranked = [...input.places].sort((a, b) => preferenceScore(b.preference) - preferenceScore(a.preference));
    return Promise.resolve({
      placements: ranked.slice(0, capacity).map((place, index) => ({
        savedPlaceId: place.id,
        date: dates[Math.floor(index / perDay)]!,
        position: index % perDay,
      })),
      unplaced: ranked.slice(capacity).map((place) => ({ savedPlaceId: place.id, reason: 'DAILY_CAPACITY' })),
    });
  }
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function preferenceScore(preference: string): number {
  return preference === 'must' ? 2 : preference === 'want' ? 1 : 0;
}
