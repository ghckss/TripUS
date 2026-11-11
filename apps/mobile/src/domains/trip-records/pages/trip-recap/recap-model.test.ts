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
    expect(slides.map((slide) => slide.kind)).toEqual(["cover", "route", "day", "day", "favorites"]);
    expect(slides[2]).toMatchObject({ kind: "day", day: { memory: "골목이 좋았다", rating: 5 } });
  });
});
