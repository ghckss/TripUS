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
}

export interface AiPlannerPlacement {
  savedPlaceId: string;
  date: string;
  position: number;
}

export interface AiPlannerOutput {
  placements: AiPlannerPlacement[];
  unplaced: Array<{ savedPlaceId: string; reason: string }>;
}

export interface AiPlannerPort {
  generate(input: AiPlannerInput): Promise<AiPlannerOutput>;
}
