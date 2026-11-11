import { Injectable } from '@nestjs/common';

import { AiPlannerInput, AiPlannerOutput, AiPlannerPort } from '../domain/ai-planner.port';

@Injectable()
export class MockAiPlannerAdapter implements AiPlannerPort {
  generate(input: AiPlannerInput): Promise<AiPlannerOutput> {
    const dates = enumerateDates(input.trip.startDate, input.trip.endDate);
    const perDay = input.style.recommendedPlacesPerDay;
    const capacity = dates.length * perDay;
    const ranked = [...input.places].sort((a, b) => preferenceScore(b.preference) - preferenceScore(a.preference));
    return Promise.resolve({
      placements: ranked.slice(0, capacity).map((place, index) => ({
        savedPlaceId: place.id,
        date: dates[Math.floor(index / perDay)]!,
        position: index % perDay,
        startTime: `${String(9 + (index % perDay) * 2).padStart(2, '0')}:00`,
        durationMinutes: 90,
        activity: `${place.name} 방문`,
        travelMethod: '대중교통',
        travelDurationMinutes: 20,
      })),
      unplaced: ranked.slice(capacity).map((place) => ({ savedPlaceId: place.id, reason: 'DAILY_CAPACITY' })),
      recommendations: [],
      planBs: [],
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
