import { apiErrorMessage, safeErrorMessage } from "./api-error-message";

describe("apiErrorMessage", () => {
  it("maps a UPPER_SNAKE_CASE server error code to Korean", () => {
    expect(apiErrorMessage({ code: "TRIP_NOT_FOUND" })).toBe("여행을 찾을 수 없어요.");
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
