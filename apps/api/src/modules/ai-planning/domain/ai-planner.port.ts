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
  goal: '저장 장소를 중심으로 하되 부족한 구간은 실제 장소 추천으로 채워, 사용자가 수정 없이 바로 사용할 수 있는 완전하고 현실적인 일자별 여행 일정을 만든다.',
  rules: [
    '모든 저장 장소를 정확히 한 번 배치하고 unplaced는 비워 둔다.',
    'targetPlannedMinutes가 0보다 큰 모든 날짜를 목표 시간 이상으로 채운다.',
    '저장 장소만으로 시간이 부족하면 선택 지역 또는 해당 저장 장소 주변의 구체적인 방문 장소를 필요한 만큼 recommendations에 추가한다.',
    'availableStartTime과 availableEndTime 안에서 이동시간까지 포함해 겹치지 않는 시간표를 만든다.',
    'startLodging과 endLodging이 있으면 그 지점에서 시작하고 끝내며, 없으면 숙소를 만들지 않는다.',
    '가까운 장소를 한 권역으로 묶고 추천 장소 사이의 이동은 30분 이내가 되도록 한다.',
    '선호, 기피 대상, 여행 스타일, 이동수단, 예산 및 lockedPlacements를 존중한다.',
    '추천은 검색 가능한 실제 관광지, 식당, 카페, 시장, 상점, 공원, 박물관 또는 문화시설만 사용한다.',
    '역, 공항, 숙소, 도시, 동네, 행정구역을 활동 장소로 추천하지 않는다.',
    '모든 사용자 노출 문구는 한국어로 작성한다.',
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
  /** Earliest and latest usable itinerary times after applying trip boundaries. */
  availableStartTime?: string;
  availableEndTime?: string;
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
