export const AI_PLANNER_PORT = Symbol('AI_PLANNER_PORT');

export enum TravelDensity {
  Balanced = 'balanced',
  Busy = 'busy',
  Relaxed = 'relaxed',
}

export enum TravelTheme {
  Cafes = 'cafes',
  Culture = 'culture',
  Food = 'food',
  Highlights = 'highlights',
  Nature = 'nature',
  Shopping = 'shopping',
}

export interface AiPlannerTravelDensity {
  id: TravelDensity;
  guidance: string;
}

export const TRAVEL_DENSITY_POLICIES: Record<TravelDensity, AiPlannerTravelDensity> = {
  [TravelDensity.Balanced]: {
    id: TravelDensity.Balanced,
    guidance: 'Balance must-visit places, travel efficiency, meals, and rest while building a complete but realistic day. For each full trip date, plan at least 450 total minutes of visits and travel.',
  },
  [TravelDensity.Relaxed]: {
    id: TravelDensity.Relaxed,
    guidance: 'Keep comfortable breaks and short travel legs, but still build a complete day instead of stopping after only one or two visits. For each full trip date, plan at least 420 total minutes of visits and travel.',
  },
  [TravelDensity.Busy]: {
    id: TravelDensity.Busy,
    guidance: 'Build a full, energetic route with more worthwhile stops while preserving realistic travel and meal times. For each full trip date, plan at least 480 total minutes of visits and travel.',
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
    '첫날 아침과 마지막 날 저녁은 만들지 않는다. 그 외 사용 가능한 식사 시간에는 실제 식사 장소를 배치하되, 첫날 시작이 14:00보다 늦으면 점심을 만들지 않고 마지막 날 종료가 12:00보다 이르면 점심을 만들지 않는다. 카페나 디저트로 식사를 대체하지 않는다.',
    'startLodging과 endLodging이 있으면 그 지점에서 시작하고 끝내며, 없으면 숙소를 만들지 않는다.',
    '가까운 장소를 한 권역으로 묶고 추천 장소 사이의 이동은 30분 이내가 되도록 한다.',
    '여행 밀도, 선택한 여행 방식들, 복수 이동수단, 예산, 추가 요청사항 및 lockedPlacements를 존중한다.',
    'requiredActivityRequests에 추출된 사용자의 명시 투어·체험·공연 요청은 반드시 일정에 넣는다. 여러 장소를 뜻하는 투어 약칭은 집결지만 넣지 않고 실제 방문 장소를 풀어 같은 날 배치한다.',
    '각 장소의 영업시간과 권장 시간대를 지키며 전망대·야경 명소·야시장·아침 전문점처럼 시간대가 경험 품질을 좌우하는 장소를 적합한 시각에 배치한다.',
    'referenceItinerary가 있으면 수정 대상이 아닌 다른 날짜의 읽기 전용 일정이다. 해당 날짜를 변경하거나 응답에 포함하지 말고, 장소·지역·테마 중복과 여행 전체 흐름을 판단하는 참고 자료로만 사용한다.',
    '사용자가 직접 배치한 장소는 여러 날짜에 중복되어도 유지한다. AI 추천 장소는 추가 요청사항에 명시적인 재방문 요청이 없는 한 places, referenceItinerary 또는 같은 응답의 다른 날짜와 중복하지 않는다.',
    '카페, 디저트, 차처럼 관광 명소나 식사 장소가 아닌 휴식 장소는 명시적인 투어 요청이 없는 한 같은 세부 유형을 하루 한 곳만 추천한다. 카페와 디저트, 카페와 차처럼 세부 유형이 다르면 함께 추천할 수 있다.',
    '일정에 넣기에는 동선이나 시간이 맞지 않지만 추천할 가치가 있는 실제 장소는 savedRecommendations에 넣어 장소 보관함 후보로 제공한다. recommendations와 savedRecommendations의 reason에는 장소 자체의 특징과 방문 가치만 사실적으로 작성하고, 일정 제외·교체·공간 부족·보관함 저장 같은 내부 처리 사유는 쓰지 않는다.',
    'places 중 note가 비어 있는 모든 장소에는 장소 자체의 특징과 방문 가치를 설명하는 사실적인 한국어 한두 문장을 placeDescriptions에 작성한다. 이미 note가 있는 장소는 수정하지 않는다.',
    '추천은 검색 가능한 실제 관광지, 식당, 카페, 시장, 상점, 공원, 박물관 또는 문화시설만 사용한다.',
    '식당, 카페, 술집은 여행지의 현지 음식과 문화를 경험할 수 있는 장소를 우선하며, 사용자가 명시적으로 요청하지 않은 타국 콘셉트 업장은 추천하지 않는다.',
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
  primaryType: string | null;
  regularOpeningHours: {
    periods: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
    weekdayDescriptions: string[];
  } | null;
}

export interface AiPlannerRequiredActivityRequest {
  name: string;
  sourceText: string;
  fullDay: boolean;
  minimumStops: number;
}

export type AiVisitTimeSlot = 'any' | 'morning' | 'lunch' | 'daytime' | 'sunset' | 'evening' | 'night';

export type AiPlannerReviewFocus = 'route_time' | 'traveler_intent' | 'meal_density';

export interface AiPlannerReviewIssue {
  severity: 'warning' | 'blocking';
  code: string;
  date: string | null;
  placeNames: string[];
  finding: string;
  requiredChange: string;
}

export interface AiPlannerReview {
  focus: AiPlannerReviewFocus;
  verdict: 'pass' | 'revise';
  summary: string;
  issues: AiPlannerReviewIssue[];
  usage?: { inputTokens: number; outputTokens: number };
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
  isFirstDay?: boolean;
  isLastDay?: boolean;
  startLodging: AiPlannerLodging | null;
  endLodging: AiPlannerLodging | null;
  /** Earliest and latest usable itinerary times after applying trip boundaries. */
  availableStartTime?: string;
  availableEndTime?: string;
  /** Visit and travel minutes that can realistically fit in this date's available window. */
  targetPlannedMinutes?: number;
  hasStartBoundary?: boolean;
  hasEndBoundary?: boolean;
}

export interface AiPlannerReferenceDay {
  date: string;
  visits: Array<{
    placeName: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    tag: string;
    scheduledTime: string | null;
  }>;
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
  density: AiPlannerTravelDensity;
  travelerContext: {
    companions: string | null;
    transportModes: string[];
    budgetLevel: string | null;
    themes: TravelTheme[];
    additionalRequests: string | null;
    /** Named tours, experiences, performances, or activities that must appear in the itinerary. */
    requiredActivityRequests: AiPlannerRequiredActivityRequest[];
  };
  places: AiPlannerPlace[];
  days: AiPlannerDay[];
  /** Existing dates outside a targeted day update. Context only; never modify or return them. */
  referenceItinerary: AiPlannerReferenceDay[];
  lockedPlacements: AiPlannerPlacement[];
  priorRecommendations: string[];
  /** Previous rejected draft. Present only during a validation-driven revision request. */
  revisionDraft?: Omit<AiPlannerOutput, 'usage'>;
  revisionGuidance?: string;
  /** Independent specialist reviews to reconcile during the integration pass. */
  orchestrationReviews?: AiPlannerReview[];
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
  preferredTimeSlot?: AiVisitTimeSlot;
}

export interface AiPlannerOutput {
  placements: AiPlannerPlacement[];
  unplaced: Array<{ savedPlaceId: string; reason: string }>;
  placeDescriptions?: Array<{
    savedPlaceId: string;
    description: string;
  }>;
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
    preferredTimeSlot?: AiVisitTimeSlot;
  }>;
  savedRecommendations?: Array<{
    placeName: string;
    regionName: string;
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
  review?(
    input: AiPlannerInput,
    draft: Omit<AiPlannerOutput, 'usage'>,
    focus: AiPlannerReviewFocus,
  ): Promise<AiPlannerReview>;
}
