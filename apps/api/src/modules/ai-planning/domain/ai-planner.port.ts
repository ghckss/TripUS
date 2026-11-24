export const AI_PLANNER_PORT = Symbol('AI_PLANNER_PORT');

export enum TravelTheme {
  Cafes = 'cafes',
  Culture = 'culture',
  Food = 'food',
  Highlights = 'highlights',
  Nature = 'nature',
  Shopping = 'shopping',
}

export interface AiPlannerPlace {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  tag: string;
  preference: string;
  note: string | null;

}

export type AiMealType = 'breakfast' | 'lunch' | 'dinner';

export interface AiPlannerLodging {
  savedPlaceId: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AiPlannerDay {
  date: string;
  isFirstDay?: boolean;
  isLastDay?: boolean;
  startLodging: AiPlannerLodging | null;
  endLodging: AiPlannerLodging | null;
}

export interface AiPlannerInput {
  preferences: {
    themes: TravelTheme[];
    companions: string | null;
    transportModes: Array<'public_transit' | 'walking' | 'car'>;
    budgetLevel: 'budget' | 'standard' | 'premium';
    additionalRequests: string | null;
  };
  trip: {
    title: string;
    destination: string;
    regions: Array<{ name: string; address: string | null; latitude: number | null; longitude: number | null }>;
    timezone: string;
    startDate: string;
    endDate: string;
    startPoint: AiPlannerBoundaryPoint | null;
    endPoint: AiPlannerBoundaryPoint | null;
    lodgings: AiPlannerLodging[];
  };
  places: AiPlannerPlace[];
  days: AiPlannerDay[];
}

export interface AiPlannerBoundaryPoint {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  time: string | null;
}

/** One actual visit; its array index is its position within the day. */
export interface AiPlannerVisit {
  savedPlaceId: string | null;
  placeName: string;
  regionName: string;
  startTime: string;
  durationMinutes: number;
  description: string;
  mealType: AiMealType | null;
}

export interface AiPlannerOutput {
  days: Array<{
    date: string;
    visits: AiPlannerVisit[];
  }>;
  usage?: { inputTokens: number; outputTokens: number };
}

export class AiPlannerError extends Error {
  constructor(
    public readonly reason: 'refused' | 'incomplete' | 'invalid_output' | 'provider_failure' | 'timeout' | 'output_limit',
    public readonly details: Record<string, unknown> = {},
  ) {
    super(`AI planner failed: ${reason}`);
    this.name = 'AiPlannerError';
  }
}

export interface AiPlannerPort {
  generate(input: AiPlannerInput, context?: { generationId: string; tripId: string }): Promise<AiPlannerOutput>;

}
