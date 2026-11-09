import type { SavedPlace } from "@/domains/places/api/places.api";
import type { Itinerary } from "../../api/itineraries.api";

function lodgingEndpoint(place: SavedPlace, date: string, edge: "start" | "end"): Itinerary["items"][number] {
  return {
    id: `local:lodging:${edge}:${date}:${place.id}`,
    savedPlaceId: place.id,
    placeName: place.name,
    address: place.address,
    date,
    position: 0,
    locked: false,
    source: "manual",
    visitStatus: null,
    rating: null,
    review: null,
  };
}

export function ensureLodgingEndpoints(itinerary: Itinerary, dates: string[], places: SavedPlace[]): Itinerary {
  const lodging = places.find((place) => place.isPrimaryLodging);
  if (!lodging) return itinerary;
  const datedItems = new Set(dates);
  const nextItems = itinerary.items.filter((item) => !datedItems.has(item.date ?? ""));
  dates.forEach((date) => {
    const day = itinerary.items.filter((item) => item.date === date).sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    const existingLodgings = day.filter((item) => item.savedPlaceId === lodging.id);
    const visits = day.filter((item) => item.savedPlaceId !== lodging.id);
    nextItems.push(
      { ...(existingLodgings[0] ?? lodgingEndpoint(lodging, date, "start")), position: 0 },
      ...visits.map((item, index) => ({ ...item, position: index + 1 })),
      { ...(existingLodgings[1] ?? lodgingEndpoint(lodging, date, "end")), position: visits.length + 1 },
    );
  });
  return {
    items: nextItems,
    unplaced: itinerary.unplaced.filter((item) => item.savedPlaceId !== lodging.id),
  };
}
