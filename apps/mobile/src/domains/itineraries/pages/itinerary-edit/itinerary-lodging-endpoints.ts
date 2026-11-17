import type { SavedPlace } from "@/domains/places/api/places.api";
import type { Itinerary } from "../../api/itineraries.api";
import { isItineraryBoundary } from "../../api/itineraries.api";

export type LodgingEdge = "start" | "end";

function lodgingEndpoint(place: SavedPlace, date: string, edge: LodgingEdge): Itinerary["items"][number] {
  return {
    id: `local:lodging:${edge}:${date}:${place.id}`,
    savedPlaceId: place.id,
    placeName: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    date,
    position: 0,
    locked: false,
    source: "manual",
    visitStatus: null,
    rating: null,
    review: null,
  };
}

export function isLodgingPlace(place: SavedPlace | undefined): boolean {
  return Boolean(place && (place.isPrimaryLodging || place.tag === "lodging"));
}

function withPlace(
  item: Itinerary["items"][number],
  place: SavedPlace,
): Itinerary["items"][number] {
  return {
    ...item,
    savedPlaceId: place.id,
    placeName: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

export function replaceLodgingBoundary(
  itinerary: Itinerary,
  dates: string[],
  date: string,
  edge: LodgingEdge,
  place: SavedPlace,
): Itinerary {
  const dateIndex = dates.indexOf(date);
  if (dateIndex < 0) return itinerary;
  const targets = [{ date, edge }];
  if (edge === "start" && dates[dateIndex - 1]) targets.push({ date: dates[dateIndex - 1], edge: "end" });
  if (edge === "end" && dates[dateIndex + 1]) targets.push({ date: dates[dateIndex + 1], edge: "start" });

  const targetIds = new Set(targets.flatMap((target) => {
    const day = itinerary.items
      .filter((item) => item.date === target.date)
      .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    const endpoint = target.edge === "start" ? day[0] : day.at(-1);
    return endpoint ? [endpoint.id] : [];
  }));

  return {
    ...itinerary,
    items: itinerary.items.map((item) => targetIds.has(item.id) ? withPlace(item, place) : item),
    unplaced: itinerary.unplaced.filter((item) => item.savedPlaceId !== place.id),
  };
}

export function ensureLodgingEndpoints(itinerary: Itinerary, dates: string[], places: SavedPlace[]): Itinerary {
  const lodging = places.find((place) => place.isPrimaryLodging);
  if (!lodging) return itinerary;
  const placesById = new Map(places.map((place) => [place.id, place]));
  const datedItems = new Set(dates);
  const nextItems = itinerary.items.filter((item) => !datedItems.has(item.date ?? ""));
  dates.forEach((date, dateIndex) => {
    const day = itinerary.items.filter((item) => item.date === date).sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    const startBoundary = day.find((item) => item.boundaryType === "start_point");
    const endBoundary = day.find((item) => item.boundaryType === "end_point");
    const dayWithoutBoundaries = day.filter((item) => !isItineraryBoundary(item));
    const isLodgingItem = (item: Itinerary["items"][number] | undefined) => isLodgingPlace(item ? placesById.get(item.savedPlaceId) : undefined);
    const includeStart = dateIndex > 0;
    const includeEnd = dateIndex < dates.length - 1;
    const existingStart = includeStart && isLodgingItem(dayWithoutBoundaries[0]) ? dayWithoutBoundaries[0] : undefined;
    const existingEnd = includeEnd
      ? [...dayWithoutBoundaries].reverse().find((item) => item.id !== existingStart?.id && isLodgingItem(item))
      : undefined;
    const start = includeStart ? existingStart ?? lodgingEndpoint(lodging, date, "start") : undefined;
    const end = includeEnd ? existingEnd ?? lodgingEndpoint(lodging, date, "end") : undefined;
    const visits = dayWithoutBoundaries.filter((item) => !isLodgingItem(item));
    const boundaryStartItems = startBoundary ? [{ ...startBoundary, position: 0 }] : [];
    const startItems = start ? [{ ...start, position: boundaryStartItems.length }] : [];
    const visitOffset = boundaryStartItems.length + startItems.length;
    const endItems = end ? [{ ...end, position: visits.length + visitOffset }] : [];
    const boundaryEndItems = endBoundary ? [{ ...endBoundary, position: visits.length + visitOffset + endItems.length }] : [];
    nextItems.push(
      ...boundaryStartItems,
      ...startItems,
      ...visits.map((item, index) => ({ ...item, position: index + visitOffset })),
      ...endItems,
      ...boundaryEndItems,
    );
  });
  const endpointIds = new Set(dates.flatMap((date) => {
    const day = nextItems.filter((item) => item.date === date).sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    return [day[0]?.savedPlaceId, day.at(-1)?.savedPlaceId].filter((id): id is string => Boolean(id));
  }));
  return {
    ...itinerary,
    items: nextItems,
    unplaced: itinerary.unplaced.filter((item) => !endpointIds.has(item.savedPlaceId)),
  };
}
