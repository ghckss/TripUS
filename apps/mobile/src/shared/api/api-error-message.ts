const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ACCESS_TOKEN_INVALID: "로그인이 만료되었어요. 다시 로그인해 주세요.",
  AI_GENERATION_LIMIT_REACHED: "무료 AI 일정 생성 횟수를 모두 사용했어요.",
  AI_PLACE_LIMIT_EXCEEDED: "AI 일정에는 장소를 최대 100개까지 넣을 수 있어요.",
  AI_PLANNING_RATE_LIMITED: "AI 일정 요청이 많아요. 잠시 후 다시 시도해 주세요.",
  AUTHENTICATION_REQUIRED: "로그인이 필요해요.",
  CONFLICT: "이미 처리되었거나 현재 상태에서는 요청을 완료할 수 없어요.",
  DATABASE_UNAVAILABLE: "서비스에 잠시 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
  DEVELOPMENT_LOGIN_DISABLED: "개발용 로그인을 사용할 수 없어요.",
  DEVELOPMENT_USER_UNAVAILABLE: "개발용 사용자 정보를 찾을 수 없어요.",
  DUPLICATE_ITINERARY_ITEM: "같은 일정이 중복되어 있어요.",
  DUPLICATE_TRIP_REGION: "같은 도시나 지역이 중복되어 있어요.",
  FORBIDDEN: "이 작업을 수행할 권한이 없어요.",
  INTERNAL_ERROR: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
  INVALID_REGION_COORDINATES: "도시나 지역의 위치 정보가 올바르지 않아요.",
  INVALID_REGION_NAME: "도시나 지역 이름을 입력해 주세요.",
  INVALID_REQUEST: "입력한 내용을 다시 확인해 주세요.",
  INVALID_SOCIAL_IDENTITY: "소셜 로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.",
  INVALID_ITINERARY_ITEM_ID: "사진을 연결할 방문 장소가 올바르지 않아요.",
  INVALID_TRIP_DATE_RANGE: "여행 종료일은 시작일보다 빠를 수 없어요.",
  ITINERARY_ITEM_NOT_FOUND: "일정 항목을 찾을 수 없어요.",
  ITINERARY_ITEM_TRIP_MISMATCH: "이 여행에 포함되지 않은 일정 항목이에요.",
  NOT_FOUND: "요청한 정보를 찾을 수 없어요.",
  NOT_VISITED_RATING_NOT_ALLOWED: "방문하지 않은 장소에는 평점을 남길 수 없어요.",
  PAYLOAD_TOO_LARGE: "파일 크기가 너무 커요.",
  PHOTO_ALREADY_FINALIZED: "이미 업로드가 완료된 사진이에요.",
  PHOTO_CONTENT_TYPE_MISMATCH: "사진 파일 형식이 올바르지 않아요.",
  PHOTO_FORMAT_UNSUPPORTED: "이 사진 형식은 바로 처리할 수 없어요. JPG로 변환한 뒤 다시 시도해 주세요.",
  PHOTO_NOT_FOUND: "사진을 찾을 수 없어요.",
  PHOTO_PROCESSING_FAILED: "사진을 처리하지 못했어요. 다른 사진으로 다시 시도해 주세요.",
  PHOTO_STORAGE_UNAVAILABLE: "사진 저장소에 잠시 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
  PHOTO_TOO_LARGE: "사진 한 장은 100MB보다 작아야 해요.",
  PHOTO_VARIANT_NOT_FOUND: "요청한 사진을 찾을 수 없어요.",
  PLACE_PHOTO_LIMIT_REACHED: "장소마다 사진은 한 장만 등록할 수 있어요.",
  PLACE_PROVIDER_UNAVAILABLE: "장소 검색 서비스에 잠시 연결할 수 없어요.",
  PLAN_UPGRADE_UNAVAILABLE: "현재는 Plus 업그레이드를 진행할 수 없어요.",
  RATE_LIMITED: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
  REFRESH_TOKEN_INVALID: "로그인이 만료되었어요. 다시 로그인해 주세요.",
  REFRESH_TOKEN_USER_UNAVAILABLE: "사용자 정보를 확인할 수 없어요. 다시 로그인해 주세요.",
  ROUTE_PROVIDER_UNAVAILABLE: "경로 검색 서비스에 잠시 연결할 수 없어요.",
  SAVED_PLACE_NOT_FOUND: "저장한 장소를 찾을 수 없어요.",
  SAVED_PLACES_NOT_FOUND: "일부 저장한 장소를 찾을 수 없어요. 목록을 새로고침해 주세요.",
  SERVICE_UNAVAILABLE: "서비스에 잠시 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
  SOCIAL_LOGIN_NOT_CONFIGURED: "해당 소셜 로그인을 현재 사용할 수 없어요.",
  TRIP_LIMIT_REACHED: "무료 플랜에서는 여행을 1개까지 만들 수 있어요.",
  TRIP_NOT_FOUND: "여행을 찾을 수 없어요.",
  UNAUTHORIZED: "로그인이 필요하거나 로그인 정보가 만료되었어요.",
  VALIDATION_FAILED: "입력한 내용을 다시 확인해 주세요.",
};

const DEFAULT_ERROR_MESSAGE = "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

export function apiErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
  return code ? ERROR_MESSAGES[code] ?? DEFAULT_ERROR_MESSAGE : safeErrorMessage(error, DEFAULT_ERROR_MESSAGE);
}

export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && /[가-힣]/.test(error.message)) return error.message;
  return fallback;
}
