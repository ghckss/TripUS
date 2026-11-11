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
  recommendedPlacesPerDay: number;
}

export const TRAVEL_STYLE_POLICIES: Record<TravelStyle, AiPlannerTravelStyle> = {
  [TravelStyle.Balanced]: {
    id: TravelStyle.Balanced,
    guidance: 'Balance must-visit places, travel efficiency, and rest without overloading a day.',
    recommendedPlacesPerDay: 3,
  },
  [TravelStyle.Relaxed]: {
    id: TravelStyle.Relaxed,
    guidance: 'Keep the pace relaxed, normally around two visit places per day, with short and practical travel legs.',
    recommendedPlacesPerDay: 2,
  },
  [TravelStyle.Highlights]: {
    id: TravelStyle.Highlights,
    guidance: 'Prioritize must-visit highlights, then arrange the remaining places by geographic efficiency.',
    recommendedPlacesPerDay: 3,
  },
  [TravelStyle.Food]: {
    id: TravelStyle.Food,
    guidance: 'Prioritize food and cafe places around sensible meal times while keeping nearby attractions in the route.',
    recommendedPlacesPerDay: 3,
  },
};

export const AI_PLANNING_TASK = {
  type: 'create_travel_itinerary' as const,
  goal: 'Create a practical day-by-day itinerary centered on the places the traveler explicitly saved, then supplement genuinely empty or underfilled days with useful places inside the selected regions.',
  rules: [
    'Start each day from startLodging and finish at endLodging when provided.',
    'Group geographically nearby places into a coherent area route and normally keep each travel leg within 30 minutes.',
    'Respect the daily time window, travel-style guidance, preferences, and locked placements.',
    'The primary objective is to schedule the traveler-saved places. Do not replace or deprioritize them merely to add recommendations.',
    'Return places that cannot be scheduled realistically in unplaced with a reason.',
    'Treat selected regions as a hard geographic boundary for the itinerary.',
    'After scheduling saved places, add only as many recommendations as needed to avoid lodging-only or impractically empty days. Never expand the itinerary into an unselected region.',
    'Recommendations must be visitable attractions, restaurants, cafes, shops, parks, or cultural venues. Never recommend a station, airport, lodging, or administrative area as an activity.',
    'Include one practical indoor Plan B for every day and write all user-facing text in Korean.',
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
  startTime: string;
  endTime: string;
  startLodging: AiPlannerLodging | null;
  endLodging: AiPlannerLodging | null;
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
  planBs: Array<{
    date: string;
    placeName: string;
    regionName: string;
    reason: string;
  }>;
  usage?: { inputTokens: number; outputTokens: number };
}

export class AiPlannerError extends Error {
  constructor(public readonly reason: 'refused' | 'incomplete' | 'invalid_output' | 'provider_failure') {
    super(`AI planner failed: ${reason}`);
  }
}

export interface AiPlannerPort {
  generate(input: AiPlannerInput): Promise<AiPlannerOutput>;
}
