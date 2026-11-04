export const AI_PLANNER_PORT = Symbol('AI_PLANNER_PORT');

export enum TravelStyle {
  Balanced = 'balanced',
  Food = 'food',
  Highlights = 'highlights',
  Relaxed = 'relaxed',
}

export interface AiPlannerPlace {
  id: string;
  name: string;
  tag: string;
  preference: string;
  note: string | null;
}

export interface AiPlannerInput {
  destination: string;
  startDate: string;
  endDate: string;
  style: TravelStyle;
  places: AiPlannerPlace[];
  daySettings: Array<{
    date: string;
    startTime: string;
    endTime: string;
    startPlaceName: string | null;
    endPlaceName: string | null;
  }>;
  lockedPlacements: AiPlannerPlacement[];
}

export interface AiPlannerPlacement {
  savedPlaceId: string;
  date: string;
  position: number;
}

export interface AiPlannerOutput {
  placements: AiPlannerPlacement[];
  unplaced: Array<{ savedPlaceId: string; reason: string }>;
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
