import { placeDescription } from "./place-description";

describe("placeDescription", () => {
  it("keeps only an actual place description", () => {
    expect(placeDescription("AI 추천 · 오사카 도심을 한눈에 볼 수 있는 대표 전망대"))
      .toBe("오사카 도심을 한눈에 볼 수 있는 대표 전망대");
  });

  it.each([
    null,
    "",
    "AI 추천 · 보관함 · 일정상 공간 부족으로 보관함에 포함",
    "AI 추천 · 여행 일정에 저장한 장소예요.",
    "AI 추천 · 기존 장소 교체 필요로 이번 일정에서는 제외",
    "AI 추천 · 점심 일정 보완",
  ])("hides missing or internal descriptions: %s", (note) => {
    expect(placeDescription(note)).toBe("");
  });
});
