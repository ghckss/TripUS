import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, deleteCache, readCache, writeCache } from "@/shared/offline/cache";
import { trackEvent } from "@/shared/telemetry/telemetry";

export type SavedPlace = components["schemas"]["SavedPlaceResponseDto"];
export type CreateSavedPlaceInput = components["schemas"]["CreateSavedPlaceDto"];
export type SavePlaceResult = components["schemas"]["SavePlaceResultDto"];
export type PlaceSearchCandidate = components["schemas"]["PlaceSearchCandidateDto"];
export type UpdateSavedPlaceInput = components["schemas"]["UpdateSavedPlaceDto"];

export function filterTravelPlaces(places: SavedPlace[]): SavedPlace[] {
  return places.filter((place) => place.isPrimaryLodging === false || (place.isPrimaryLodging == null && place.tag !== "lodging"));
}

export async function listPlaces(tripId: string): Promise<SavedPlace[]> {
  return cachedRequest(cacheKeys.places(tripId), async () => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/places", {
      params: { path: { tripId } },
    });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  });
}

export async function listTravelPlaces(tripId: string): Promise<SavedPlace[]> {
  return filterTravelPlaces(await listPlaces(tripId));
}

export async function savePlace(
  tripId: string,
  input: CreateSavedPlaceInput,
): Promise<SavePlaceResult> {
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/places", {
    params: { path: { tripId } },
    body: input,
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (data.status === "created") {
    const places = await readCache<SavedPlace[]>(cacheKeys.places(tripId));
    if (places) await writeCache(cacheKeys.places(tripId), [data.place, ...places]);
    trackEvent("place.saved", { tripId, placeId: data.place.id, tag: data.place.tag });
  }
  return data;
}

export async function searchPlaces(tripId: string, query: string): Promise<PlaceSearchCandidate[]> {
  const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/places/search", {
    params: { path: { tripId }, query: { query } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

export async function searchPlacesByDestination(destination: string, query: string): Promise<PlaceSearchCandidate[]> {
  const { data, error } = await tripUsApi.GET("/v1/places/search", {
    params: { query: { destination, query } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

export async function updatePlace(
  tripId: string,
  placeId: string,
  input: UpdateSavedPlaceInput,
): Promise<SavedPlace> {
  const { data, error } = await tripUsApi.PATCH("/v1/trips/{tripId}/places/{placeId}", {
    params: { path: { tripId, placeId } },
    body: input,
  });
  if (error) throw new Error(apiErrorMessage(error));
  const places = await readCache<SavedPlace[]>(cacheKeys.places(tripId));
  if (places) await writeCache(cacheKeys.places(tripId), places.map((place) => place.id === placeId ? data : place));
  return data;
}

export async function deletePlace(tripId: string, placeId: string): Promise<void> {
  const { error } = await tripUsApi.DELETE("/v1/trips/{tripId}/places/{placeId}", {
    params: { path: { tripId, placeId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  const places = await readCache<SavedPlace[]>(cacheKeys.places(tripId));
  if (places) await writeCache(cacheKeys.places(tripId), places.filter((place) => place.id !== placeId));
  await deleteCache(cacheKeys.itinerary(tripId));
}
