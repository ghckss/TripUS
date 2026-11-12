export const AI_PLANNER_PORT = Symbol('AI_PLANNER_PORT');

export enum TravelStyle {
  Balanced = 'balanced',
  Food = 'food',
  Highlights = 'highlights',
  Relaxed = 'relaxed',
}

export interface AiPlannerTravelStyle {
  id: TravelStyle;
  guidance: string;
}

export const TRAVEL_STYLE_POLICIES: Record<TravelStyle, AiPlannerTravelStyle> = {
  [TravelStyle.Balanced]: {
    id: TravelStyle.Balanced,
    guidance: 'Balance must-visit places, travel efficiency, meals, and rest while building a complete but realistic day. For each full trip date, plan at least 450 total minutes of visits and travel.',
  },
  [TravelStyle.Relaxed]: {
    id: TravelStyle.Relaxed,
    guidance: 'Keep comfortable breaks and short travel legs, but still build a complete day instead of stopping after only one or two visits. For each full trip date, plan at least 420 total minutes of visits and travel.',
  },
  [TravelStyle.Highlights]: {
    id: TravelStyle.Highlights,
    guidance: 'Prioritize must-visit highlights, then add nearby worthwhile places to form a complete route. For each full trip date, plan at least 480 total minutes of visits and travel.',
  },
  [TravelStyle.Food]: {
    id: TravelStyle.Food,
    guidance: 'Prioritize food and cafe places around sensible meal times while filling the day with nearby attractions and activities. For each full trip date, plan at least 450 total minutes of visits and travel.',
  },
};

export const AI_PLANNING_TASK = {
  type: 'create_travel_itinerary' as const,
  goal: 'Create a complete practical day-by-day itinerary. Center it on traveler-saved places when supplied, or build the entire itinerary from suitable recommendations when none are supplied.',
  rules: [
    'Start each day from startLodging and finish at endLodging when provided.',
    'Group geographically nearby places into a coherent area route and normally keep each travel leg within 30 minutes.',
    'Respect the travel-style guidance, preferences, and locked placements.',
    'The primary objective is to schedule the traveler-saved places. Do not replace or deprioritize them merely to add recommendations.',
    'When no traveler-saved places are supplied, create the full itinerary from concrete recommendations inside the selected regions.',
    'Lodging is optional. When a day has no startLodging or endLodging, plan directly from the first visit to the last visit without inventing a lodging place.',
    'Return places that cannot be scheduled realistically in unplaced with a reason.',
    'Treat selected regions as a hard geographic boundary for the itinerary.',
    'After scheduling saved places, add enough useful recommendations to form a complete day without rushing. Never stop after only one or two short visits when the route can reasonably include more.',
    'Recommendations must be visitable attractions, restaurants, cafes, shops, parks, or cultural venues. Never recommend a station, airport, lodging, or administrative area as an activity.',
    'Treat priorRecommendations as optional previous AI suggestions, not traveler-required places. Reuse one when it is still the best fit, or replace it when a better route or place exists.',
    'Write all user-facing text in Korean.',
  ],
};

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

export interface AiPlannerLodging {
  savedPlaceId: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AiPlannerDay {
  date: string;
  startLodging: AiPlannerLodging | null;
  endLodging: AiPlannerLodging | null;
  /** Visit and travel minutes that can realistically fit in this date's available window. */
  targetPlannedMinutes?: number;
}

export interface AiPlannerInput {
  task: typeof AI_PLANNING_TASK;
  trip: {
    title: string;
    destination: string;
    regions: Array<{
      name: string;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    }>;
    timezone: string;
    startDate: string;
    endDate: string;
    startPoint: AiPlannerBoundaryPoint | null;
    endPoint: AiPlannerBoundaryPoint | null;
  };
  style: AiPlannerTravelStyle;
  travelerContext: {
    companions: string | null;
    transportMode: string | null;
    budgetLevel: string | null;
    preferences: string | null;
    avoidances: string | null;
  };
  places: AiPlannerPlace[];
  days: AiPlannerDay[];
  lockedPlacements: AiPlannerPlacement[];
  priorRecommendations: string[];
  revisionGuidance?: string;
}

export interface AiPlannerBoundaryPoint {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  time: string | null;
}

export interface AiPlannerPlacement {
  savedPlaceId: string;
  date: string;
  position: number;
  startTime?: string;
  durationMinutes?: number;
  activity?: string;
  travelMethod?: string;
  travelDurationMinutes?: number;
}

export interface AiPlannerOutput {
  placements: AiPlannerPlacement[];
  unplaced: Array<{ savedPlaceId: string; reason: string }>;
  recommendations: Array<{
    placeName: string;
    regionName: string;
    suggestedDate: string;
    position: number;
    startTime: string;
    durationMinutes: number;
    activity: string;
    travelMethod: string;
    travelDurationMinutes: number;
    reason: string;
  }>;
  usage?: { inputTokens: number; outputTokens: number };
}

export class AiPlannerError extends Error {
  constructor(
    public readonly reason: 'refused' | 'incomplete' | 'invalid_output' | 'provider_failure',
    public readonly details: Record<string, unknown> = {},
  ) {
    super(`AI planner failed: ${reason}`);
    this.name = 'AiPlannerError';
  }
}

export interface AiPlannerPort {
  generate(input: AiPlannerInput): Promise<AiPlannerOutput>;
}
