import { resolveTripProgress } from "./trip-progress";

describe("resolveTripProgress", () => {
  const timezone = "Asia/Seoul";

  it("shows the regular preparation state until six days before departure", () => {
    expect(resolveTripProgress("2026-11-16", "2026-11-18", timezone, new Date("2026-11-09T15:00:00Z"))).toEqual({
      phase: "before", badgeLabel: "여행 예정", heading: "준비가 한창이에요", message: null,
    });
  });

  it.each([
    ["2026-11-10T03:00:00Z", "D-5", "출발까지 5일 남았어요!"],
    ["2026-11-14T03:00:00Z", "D-1", "출발까지 1일 남았어요!"],
  ])("shows a countdown from five to one days before departure", (now, badgeLabel, heading) => {
    expect(resolveTripProgress("2026-11-15", "2026-11-18", timezone, new Date(now))).toEqual({
      phase: "countdown", badgeLabel, heading, message: "여행 준비는 잘 되고 있나요?",
    });
  });

  it("shows the traveling state from the start date through the end date", () => {
    expect(resolveTripProgress("2026-11-15", "2026-11-18", timezone, new Date("2026-11-18T03:00:00Z"))).toEqual({
      phase: "during", badgeLabel: "여행 중", heading: "지금 여행을 즐기고 계신가요?", message: null,
    });
  });

  it("shows the completed state after the end date", () => {
    expect(resolveTripProgress("2026-11-15", "2026-11-18", timezone, new Date("2026-11-18T15:00:00Z"))).toEqual({
      phase: "after", badgeLabel: "여행 완료", heading: "여행은 즐거우셨나요?", message: "여행의 순간을 정리해 보세요",
    });
  });
});
