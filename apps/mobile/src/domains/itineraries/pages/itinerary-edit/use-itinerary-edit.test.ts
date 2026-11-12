import type { SavedPlace } from "@/domains/places/api/places.api";
import type { Itinerary } from "../../api/itineraries.api";
import { ensureLodgingEndpoints, replaceLodgingBoundary } from "./itinerary-lodging-endpoints";
import { reorderItineraryWithinDay } from "./itinerary-reorder";

describe("reorderItineraryWithinDay", () => {
  it("changes only positions and preserves every itinerary detail", () => {
    const first = {
      id: "item-1", savedPlaceId: "place-1", placeName: "첫 장소", date: "2026-11-08", position: 0,
      scheduledTime: "10:00", durationMinutes: 90, activitySummary: "첫 장소 설명",
      travelMethod: "도보", travelDurationMinutes: 12, locked: false, source: "ai",
      visitStatus: null, rating: null, review: null,
    };
    const second = {
      id: "item-2", savedPlaceId: "place-2", placeName: "두 번째 장소", date: "2026-11-08", position: 1,
      scheduledTime: "12:00", durationMinutes: 60, activitySummary: "두 번째 장소 설명",
      travelMethod: "버스", travelDurationMinutes: 20, locked: false, source: "ai",
      visitStatus: null, rating: null, review: null,
    };

    const result = reorderItineraryWithinDay({ items: [first, second], unplaced: [] } as Itinerary, first.id, 1);
    const movedFirst = result.items.find(({ id }) => id === first.id)!;
    const movedSecond = result.items.find(({ id }) => id === second.id)!;

    expect(movedFirst).toEqual({ ...first, position: 1 });
    expect(movedSecond).toEqual({ ...second, position: 0 });
  });
});

describe("ensureLodgingEndpoints", () => {
  it("omits the first start and final end lodging", () => {
    const lodging = { id: "lodging-1", name: "부산 바다 호텔", isPrimaryLodging: true } as SavedPlace;
    const place = { id: "place-1", name: "감천문화마을", isPrimaryLodging: false } as SavedPlace;
    const itinerary = {
      items: [{
        id: "item-1", savedPlaceId: place.id, placeName: place.name, address: null,
        date: "2026-11-08", position: 0, locked: false, source: "manual",
        visitStatus: null, rating: null, review: null,
      }],
      unplaced: [],
    } as Itinerary;

    const result = ensureLodgingEndpoints(itinerary, ["2026-11-08", "2026-11-09"], [lodging, place]);
    const firstDay = result.items.filter((item) => item.date === "2026-11-08");
    const secondDay = result.items.filter((item) => item.date === "2026-11-09");

    expect(firstDay.map((item) => item.savedPlaceId)).toEqual([place.id, lodging.id]);
    expect(firstDay.map((item) => item.position)).toEqual([0, 1]);
    expect(secondDay.map((item) => item.savedPlaceId)).toEqual([lodging.id]);
  });

  it("changes a start lodging and only the previous day's end lodging with it", () => {
    const primary = { id: "lodging-1", name: "기본 호텔", tag: "lodging", isPrimaryLodging: true } as SavedPlace;
    const next = { id: "lodging-2", name: "새 호텔", tag: "lodging", isPrimaryLodging: false } as SavedPlace;
    const visit = { id: "place-1", name: "방문지", isPrimaryLodging: false } as SavedPlace;
    const dates = ["2026-11-08", "2026-11-09", "2026-11-10"];
    const initial = ensureLodgingEndpoints({
      items: dates.map((date, index) => ({
        id: `visit-${index}`, savedPlaceId: visit.id, placeName: visit.name, address: null,
        date, position: 0, locked: false, source: "manual" as const,
        visitStatus: null, rating: null, review: null,
      })),
      unplaced: [],
    } as Itinerary, dates, [primary, visit]);

    const changed = replaceLodgingBoundary(initial, dates, "2026-11-09", "start", next);
    const result = ensureLodgingEndpoints(changed, dates, [primary, next, visit]);
    const ids = (date: string) => result.items
      .filter((item) => item.date === date)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((item) => item.savedPlaceId);

    expect(ids("2026-11-08")).toEqual([visit.id, next.id]);
    expect(ids("2026-11-09")).toEqual([next.id, visit.id, primary.id]);
    expect(ids("2026-11-10")).toEqual([primary.id, visit.id]);
  });

  it("changes an end lodging and only the next day's start lodging with it", () => {
    const primary = { id: "lodging-1", name: "기본 호텔", tag: "lodging", isPrimaryLodging: true } as SavedPlace;
    const next = { id: "lodging-2", name: "새 호텔", tag: "lodging", isPrimaryLodging: false } as SavedPlace;
    const dates = ["2026-11-08", "2026-11-09", "2026-11-10"];
    const initial = ensureLodgingEndpoints({ items: [], unplaced: [] } as Itinerary, dates, [primary]);

    const changed = replaceLodgingBoundary(initial, dates, "2026-11-09", "end", next);
    const result = ensureLodgingEndpoints(changed, dates, [primary, next]);
    const endpoints = (date: string) => result.items
      .filter((item) => item.date === date)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((item) => item.savedPlaceId);

    expect(endpoints("2026-11-08")).toEqual([primary.id]);
    expect(endpoints("2026-11-09")).toEqual([primary.id, next.id]);
    expect(endpoints("2026-11-10")).toEqual([next.id]);
  });

  it("does not add lodging endpoints to a single-day trip", () => {
    const lodging = { id: "lodging-1", name: "기본 호텔", tag: "lodging", isPrimaryLodging: true } as SavedPlace;
    const firstVisit = { id: "place-1", name: "첫 방문지", isPrimaryLodging: false } as SavedPlace;
    const addedVisit = { id: "place-2", name: "추가 방문지", isPrimaryLodging: false } as SavedPlace;
    const date = "2026-11-08";
    const initial = ensureLodgingEndpoints({
      items: [{
        id: "visit-1", savedPlaceId: firstVisit.id, placeName: firstVisit.name, address: null,
        date, position: 0, locked: false, source: "manual", visitStatus: null, rating: null, review: null,
      }],
      unplaced: [],
    } as Itinerary, [date], [lodging, firstVisit]);
    const withAppendedVisit = {
      ...initial,
      items: [...initial.items, {
        id: "visit-2", savedPlaceId: addedVisit.id, placeName: addedVisit.name, address: null,
        date, position: 3, locked: false, source: "manual" as const, visitStatus: null, rating: null, review: null,
      }],
    };

    const result = ensureLodgingEndpoints(withAppendedVisit, [date], [lodging, firstVisit, addedVisit]);
    const ordered = result.items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    expect(ordered.map((item) => item.savedPlaceId)).toEqual([
      firstVisit.id,
      addedVisit.id,
    ]);
  });

  it("keeps the configured start first and configured end last", () => {
    const lodging = { id: "lodging-1", name: "기본 호텔", tag: "lodging", isPrimaryLodging: true } as SavedPlace;
    const visit = { id: "place-1", name: "경복궁", isPrimaryLodging: false } as SavedPlace;
    const date = "2026-11-08";
    const itinerary = {
      items: [
        { id: "boundary:start", savedPlaceId: "trip-1", placeName: "인천공항 제1터미널", date, position: 0, boundaryType: "start_point", locked: true, source: "manual" },
        { id: "visit-1", savedPlaceId: visit.id, placeName: visit.name, date, position: 1, boundaryType: null, locked: false, source: "manual" },
        { id: "boundary:end", savedPlaceId: "trip-1", placeName: "인천공항 제2터미널", date, position: 2, boundaryType: "end_point", locked: true, source: "manual" },
      ],
      unplaced: [],
    } as Itinerary;

    const result = ensureLodgingEndpoints(itinerary, [date], [lodging, visit]);
    const ordered = result.items.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));

    expect(ordered.map((item) => [item.boundaryType, item.placeName])).toEqual([
      ["start_point", "인천공항 제1터미널"],
      [null, "경복궁"],
      ["end_point", "인천공항 제2터미널"],
    ]);
  });
});
