import { filterTravelPlaces, type SavedPlace } from "./places.api";

describe("filterTravelPlaces", () => {
  it("keeps travel places and excludes the lodging used for trip settings", () => {
    const places = [
      { id: "place-1", name: "감천문화마을", tag: "attraction", isPrimaryLodging: false },
      { id: "lodging-1", name: "기본 호텔", tag: "lodging", isPrimaryLodging: true },
      { id: "hotel-1", name: "방문할 호텔", tag: "lodging", isPrimaryLodging: false },
      { id: "legacy-lodging-1", name: "이전 버전 숙소", tag: "lodging" },
    ] as SavedPlace[];

    expect(filterTravelPlaces(places)).toEqual([places[0], places[2]]);
  });
});
