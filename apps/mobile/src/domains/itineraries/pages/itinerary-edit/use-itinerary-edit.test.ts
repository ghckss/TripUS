import type { SavedPlace } from "@/domains/places/api/places.api";
import type { Itinerary } from "../../api/itineraries.api";
import { ensureLodgingEndpoints } from "./itinerary-lodging-endpoints";

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
});
