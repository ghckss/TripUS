import { apiErrorMessage, safeErrorMessage } from "./api-error-message";

describe("apiErrorMessage", () => {
  it("maps a UPPER_SNAKE_CASE server error code to Korean", () => {
    expect(apiErrorMessage({ code: "TRIP_NOT_FOUND" })).toBe("여행을 찾을 수 없어요.");
    expect(apiErrorMessage({ code: "INVALID_ITINERARY_ITEM_ID" })).toBe("사진을 연결할 방문 장소가 올바르지 않아요.");
    expect(apiErrorMessage({ code: "PHOTO_FORMAT_UNSUPPORTED" })).toBe("이 사진 형식은 바로 처리할 수 없어요. JPG로 변환한 뒤 다시 시도해 주세요.");
    expect(apiErrorMessage({ code: "PLACE_PHOTO_LIMIT_REACHED" })).toBe("장소마다 사진은 한 장만 등록할 수 있어요.");
  });

  it("does not expose an English server message", () => {
    expect(apiErrorMessage({ code: "UnknownCode", message: "Sensitive internal error" }))
      .toBe("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
  });

  it("keeps an already localized client error", () => {
    expect(safeErrorMessage(new Error("사진 권한이 필요해요."), "실패했어요."))
      .toBe("사진 권한이 필요해요.");
  });

  it("replaces an English client error with a Korean fallback", () => {
    expect(safeErrorMessage(new Error("Permission denied"), "사진을 저장하지 못했어요."))
      .toBe("사진을 저장하지 못했어요.");
  });
});
