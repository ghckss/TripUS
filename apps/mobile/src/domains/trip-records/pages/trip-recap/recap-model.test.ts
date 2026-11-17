import { buildRecapSlides } from "./recap-model";

const trip = { id: "trip-1", title: "서울 가을 여행", destination: "서울", regions: [], timezone: "Asia/Seoul", startDate: "2026-10-31", endDate: "2026-11-02", active: false };
const itinerary = {
  unplaced: [],
  items: [
    { id: "item-1", savedPlaceId: "place-1", placeName: "북촌", date: "2026-10-31", position: 0, scheduledTime: "10:00", locked: false, source: "manual" as const, visitStatus: "rated" as const, rating: 5, review: "골목이 좋았다" },
    { id: "item-2", savedPlaceId: "place-2", placeName: "서울숲", date: "2026-11-01", position: 0, scheduledTime: "13:00", locked: false, source: "manual" as const, visitStatus: "rated" as const, rating: 4 },
  ],
};

const photo = (id: string, itineraryItemId: string) => ({
  id,
  tripId: "trip-1",
  itineraryItemId,
  status: "ready" as const,
  filename: `${id}.jpg`,
  mimeType: "image/jpeg",
  byteSize: 100,
  width: 1200,
  height: 900,
  originalUrl: `https://example.com/${id}.jpg`,
  optimizedUrl: null,
  thumbnailUrl: null,
  takenAt: null,
  createdAt: "2026-11-03T00:00:00.000Z",
});

describe("trip recap model", () => {
  it("builds one schedule slide per date and no photo slide when the date has no photo", () => {
    const slides = buildRecapSlides({ trip, itinerary, photos: [] });

    expect(slides.map((slide) => slide.kind)).toEqual(["cover", "day-schedule", "day-schedule", "day-schedule"]);
    expect(slides[3]).toMatchObject({ kind: "day-schedule", day: { date: "2026-11-02", dayNumber: 3, items: [] } });
    expect(slides[0]).toMatchObject({ kind: "cover", dayCount: 3, placeCount: 2 });
  });

  it("adds at most one highlight after a day schedule and chooses the highest-rated photographed place", () => {
    const sameDayItems = [
      { ...itinerary.items[0], rating: 4 },
      { ...itinerary.items[1], id: "item-2", date: "2026-10-31", position: 1, rating: 5 },
      { ...itinerary.items[1], id: "item-3", date: "2026-10-31", position: 2, rating: 3 },
    ];
    const slides = buildRecapSlides({
      trip: { ...trip, endDate: "2026-10-31" },
      itinerary: { unplaced: [], items: sameDayItems },
      photos: [photo("photo-1", "item-1"), photo("photo-2", "item-2"), photo("photo-3", "item-3")],
    });

    expect(slides.map((slide) => slide.kind)).toEqual(["cover", "day-schedule", "day-highlight"]);
    expect(slides[2]).toMatchObject({ kind: "day-highlight", place: { id: "item-2", rating: 5 }, photo: { id: "photo-2" } });
  });

  it("uses the first photographed place when ratings are tied or missing", () => {
    const tiedItems = [
      { ...itinerary.items[0], rating: undefined },
      { ...itinerary.items[1], id: "item-2", date: "2026-10-31", position: 1, rating: undefined },
    ];
    const slides = buildRecapSlides({
      trip: { ...trip, endDate: "2026-10-31" },
      itinerary: { unplaced: [], items: tiedItems },
      photos: [photo("photo-1", "item-1"), photo("photo-2", "item-2")],
    });

    expect(slides[2]).toMatchObject({ kind: "day-highlight", place: { id: "item-1" }, photo: { id: "photo-1" } });
  });

  it("keeps a busy date on one schedule slide instead of creating overflowing continuation cards", () => {
    const busyItems = Array.from({ length: 8 }, (_, index) => ({
      id: `busy-${index}`,
      savedPlaceId: `busy-place-${index}`,
      placeName: `긴 이름의 방문 장소 ${index + 1}`,
      date: "2026-10-31",
      position: index,
      scheduledTime: `${String(9 + index).padStart(2, "0")}:00`,
      locked: false,
      source: "manual" as const,
      visitStatus: "unrated" as const,
    }));
    const slides = buildRecapSlides({ trip: { ...trip, endDate: "2026-10-31" }, itinerary: { unplaced: [], items: busyItems }, photos: [] });

    expect(slides.filter((slide) => slide.kind === "day-schedule")).toHaveLength(1);
    expect(slides[1]).toMatchObject({ kind: "day-schedule", day: { items: expect.arrayContaining(busyItems) } });
  });
});
