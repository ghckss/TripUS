import { Injectable } from '@nestjs/common';

import { AiPlannerInput, AiPlannerOutput, AiPlannerPort } from '../domain/ai-planner.port';

@Injectable()
export class MockAiPlannerAdapter implements AiPlannerPort {
  generate(input: AiPlannerInput): Promise<AiPlannerOutput> {
    const dates = enumerateDates(input.trip.startDate, input.trip.endDate);
    const ranked = [...input.places].sort((a, b) => preferenceScore(b.preference) - preferenceScore(a.preference));
    return Promise.resolve({
      placements: ranked.map((place, index) => ({
        savedPlaceId: place.id,
        date: dates[index % dates.length]!,
        position: Math.floor(index / dates.length),
        startTime: `${String(9 + Math.floor(index / dates.length) * 2).padStart(2, '0')}:00`,
        durationMinutes: 90,
        activity: `${place.name} 방문`,
        travelMethod: '대중교통',
        travelDurationMinutes: 20,
        preferredTimeSlot: 'any',
      })),
      unplaced: [],
      recommendations: [],
      savedRecommendations: [],
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
  return preference === 'must_visit' ? 2 : preference === 'want_to_visit' ? 1 : 0;
}
