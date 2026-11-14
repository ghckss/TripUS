import { buildRecapSlides, recommendedRecapMode } from "./recap-model";

const trip = { id: "trip-1", title: "서울 가을 여행", destination: "서울", regions: [], timezone: "Asia/Seoul", startDate: "2026-10-31", endDate: "2026-11-02", active: false };
const itinerary = {
  unplaced: [],
  items: [
    { id: "item-1", savedPlaceId: "place-1", placeName: "북촌", date: "2026-10-31", position: 0, locked: false, source: "manual" as const, visitStatus: "rated" as const, rating: 5, review: "골목이 좋았다" },
    { id: "item-2", savedPlaceId: "place-2", placeName: "서울숲", date: "2026-11-01", position: 0, locked: false, source: "manual" as const, visitStatus: "rated" as const, rating: 4 },
  ],
};

describe("trip recap model", () => {
  it("selects a layout that matches the available photo count", () => {
    expect(recommendedRecapMode(0)).toBe("route");
    expect(recommendedRecapMode(2)).toBe("mixed");
    expect(recommendedRecapMode(6)).toBe("photo-diary");
  });

  it("builds cover, route, daily and favorites slides", () => {
    const slides = buildRecapSlides({ trip, itinerary, photos: [], mode: "route" });
    expect(slides.map((slide) => slide.kind)).toEqual(["cover", "route", "day", "day", "day", "favorites"]);
    expect(slides[2]).toMatchObject({ kind: "day", day: { memory: "골목이 좋았다", rating: 5 } });
    expect(slides[4]).toMatchObject({ kind: "day", day: { date: "2026-11-02", dayNumber: 3, items: [] } });
    expect(slides[0]).toMatchObject({ kind: "cover", dayCount: 3, placeCount: 2 });
  });

  it("keeps every date in a four-night, five-day trip even when only two dates have visits", () => {
    const slides = buildRecapSlides({
      trip: { ...trip, endDate: "2026-11-04" },
      itinerary,
      photos: [],
      mode: "route",
    });

    const daySlides = slides.filter((slide) => slide.kind === "day");
    expect(daySlides).toHaveLength(5);
    expect(daySlides.map((slide) => slide.day.date)).toEqual([
      "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04",
    ]);
    expect(slides.filter((slide) => slide.kind === "route")).toHaveLength(2);
  });

  it("splits a busy day into additional slides instead of overflowing the fixed canvas", () => {
    const busyItems = Array.from({ length: 7 }, (_, index) => ({
      id: `busy-${index}`,
      savedPlaceId: `busy-place-${index}`,
      placeName: `긴 이름의 방문 장소 ${index + 1}`,
      date: "2026-10-31",
      position: index,
      locked: false,
      source: "manual" as const,
      visitStatus: "rated" as const,
      rating: 5,
      review: "아주 긴 후기가 있어도 다음 영역을 침범하지 않아야 한다",
    }));
    const slides = buildRecapSlides({ trip: { ...trip, endDate: "2026-10-31" }, itinerary: { unplaced: [], items: busyItems }, photos: [], mode: "route" });
    const daySlides = slides.filter((slide) => slide.kind === "day");

    expect(daySlides).toHaveLength(3);
    expect(daySlides.map((slide) => slide.day.items.length)).toEqual([3, 3, 1]);
    expect(daySlides.map((slide) => [slide.partNumber, slide.partCount])).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
});
