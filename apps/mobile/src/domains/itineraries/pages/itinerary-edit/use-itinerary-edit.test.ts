import type { SavedPlace } from "@/domains/places/api/places.api";
import type { Itinerary } from "../../api/itineraries.api";
import { ensureLodgingEndpoints, replaceLodgingBoundary } from "./itinerary-lodging-endpoints";

describe("ensureLodgingEndpoints", () => {
  it("places the primary lodging at the start and end of every day", () => {
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

    expect(firstDay.map((item) => item.savedPlaceId)).toEqual([lodging.id, place.id, lodging.id]);
    expect(firstDay.map((item) => item.position)).toEqual([0, 1, 2]);
    expect(secondDay.map((item) => item.savedPlaceId)).toEqual([lodging.id, lodging.id]);
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

    expect(ids("2026-11-08")).toEqual([primary.id, visit.id, next.id]);
    expect(ids("2026-11-09")).toEqual([next.id, visit.id, primary.id]);
    expect(ids("2026-11-10")).toEqual([primary.id, visit.id, primary.id]);
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

    expect(endpoints("2026-11-08")).toEqual([primary.id, primary.id]);
    expect(endpoints("2026-11-09")).toEqual([primary.id, next.id]);
    expect(endpoints("2026-11-10")).toEqual([next.id, primary.id]);
  });

  it("keeps the last lodging at the end when a new visit is appended", () => {
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
      lodging.id,
      firstVisit.id,
      addedVisit.id,
      lodging.id,
    ]);
  });
});
