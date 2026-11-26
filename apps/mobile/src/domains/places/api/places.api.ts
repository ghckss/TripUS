import { defineQuery, getAccountScope, invalidateResource, removeResources, setResource } from "@/shared/query/query-client";
import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, deleteCache, writeCache } from "@/shared/offline/cache";
import { trackEvent } from "@/shared/telemetry/telemetry";

export type SavedPlace = components["schemas"]["SavedPlaceResponseDto"];
export type CreateSavedPlaceInput = components["schemas"]["CreateSavedPlaceDto"];
export type SavePlaceResult = components["schemas"]["SavePlaceResultDto"];
export type PlaceSearchCandidate = components["schemas"]["PlaceSearchCandidateDto"];
export type PlacePhoto = components["schemas"]["PlacePhotoResponseDto"];
export type UpdateSavedPlaceInput = components["schemas"]["UpdateSavedPlaceDto"];

export function filterTravelPlaces(places: SavedPlace[]): SavedPlace[] {
  return places.filter((place) => place.isPrimaryLodging === false || (place.isPrimaryLodging == null && place.tag !== "lodging"));
}

export const listPlaces = defineQuery((tripId: string) => ({
  key: cacheKeys.places(tripId), staleTime: 60000,
  request: async (): Promise<SavedPlace[]> => {
    return cachedRequest(cacheKeys.places(tripId), async () => {
      const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/places", {
        params: { path: { tripId } },
      });
      if (error) throw new Error(apiErrorMessage(error));
      return data;
    });
  },
}));

export async function listTravelPlaces(tripId: string): Promise<SavedPlace[]> {
  return filterTravelPlaces(await listPlaces(tripId));
}

export const getPlacePhoto = defineQuery((tripId: string, placeId: string) => ({
  key: `trips:${tripId}:photo:${placeId}`, staleTime: 300000,
  request: async (): Promise<PlacePhoto> => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/places/{placeId}/photo", {
      params: { path: { tripId, placeId } },
    });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  },
}));

export async function savePlace(
  tripId: string,
  input: CreateSavedPlaceInput,
): Promise<SavePlaceResult> {
  const account = getAccountScope();
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/places", {
    params: { path: { tripId } },
    body: input,
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  if (data.status === "created") {
    const places = setResource<SavedPlace[]>(cacheKeys.places(tripId), (current) => current ? [data.place, ...current.filter((place) => place.id !== data.place.id)] : undefined);
    if (places) await writeCache(cacheKeys.places(tripId), places);
    if (account !== getAccountScope()) throw new Error("Session changed during request");
    void invalidateResource(cacheKeys.itinerary(tripId));
    trackEvent("place.saved", { tripId, placeId: data.place.id, tag: data.place.tag });
  }
  return data;
}

export type PlaceSearchBounds = { north: number; south: number; east: number; west: number };

export const searchPlaces = defineQuery((tripId: string, query: string, bounds?: PlaceSearchBounds) => ({
  key: `trips:${tripId}:search:${JSON.stringify([query.trim(), bounds])}`, staleTime: 60000,
  request: async (): Promise<PlaceSearchCandidate[]> => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/places/search", {
      params: { path: { tripId }, query: { query, ...bounds } },
    });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  },
}));

export const searchPlacesByDestination = defineQuery((destination: string, query: string) => ({
  key: `search:${JSON.stringify([destination, query.trim()])}`, staleTime: 60000,
  request: async (): Promise<PlaceSearchCandidate[]> => {
    const { data, error } = await tripUsApi.GET("/v1/places/search", {
      params: { query: { destination, query } },
    });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  },
}));

export const searchCities = defineQuery((country: string, countryCode: string, query: string) => ({
  key: `cities:${JSON.stringify([country, countryCode, query.trim()])}`, staleTime: 86400000,
  request: async (): Promise<PlaceSearchCandidate[]> => {
    const { data, error } = await tripUsApi.GET("/v1/places/cities", {
      params: { query: { country, countryCode, query } },
    });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  },
}));

export async function updatePlace(
  tripId: string,
  placeId: string,
  input: UpdateSavedPlaceInput,
): Promise<SavedPlace> {
  const account = getAccountScope();
  const { data, error } = await tripUsApi.PATCH("/v1/trips/{tripId}/places/{placeId}", {
    params: { path: { tripId, placeId } },
    body: input,
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  let updatedPlace = data;
  const places = setResource<SavedPlace[]>(cacheKeys.places(tripId), (current) => current?.map((place) => {
    if (place.id !== placeId) return place;
    // PATCH only changes fields the user submitted. Keep every other display field
    // from the loaded place even if an older/partial API response sends empty defaults.
    updatedPlace = {
      ...place,
      ...input,
    };
    return updatedPlace;
  }));
  if (places) await writeCache(cacheKeys.places(tripId), places);
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  removeResources(`trips:${tripId}:photo:${placeId}`);
  removeResources(`trips:${tripId}:route:`);
  void invalidateResource(cacheKeys.itinerary(tripId));
  return updatedPlace;
}

export async function deletePlace(tripId: string, placeId: string): Promise<void> {
  const account = getAccountScope();
  const { error } = await tripUsApi.DELETE("/v1/trips/{tripId}/places/{placeId}", {
    params: { path: { tripId, placeId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) return;
  const places = setResource<SavedPlace[]>(cacheKeys.places(tripId), (current) => current?.filter((place) => place.id !== placeId));
  if (places) await writeCache(cacheKeys.places(tripId), places);
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  await deleteCache(cacheKeys.itinerary(tripId));
  if (account !== getAccountScope()) return;
  void invalidateResource(cacheKeys.itinerary(tripId));
}

export async function deletePlaces(tripId: string, placeIds: string[]): Promise<void> {
  const account = getAccountScope();
  if (placeIds.length === 0) return;
  const { error } = await tripUsApi.DELETE("/v1/trips/{tripId}/places", {
    params: { path: { tripId } },
    body: { placeIds },
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) return;
  const removed = new Set(placeIds);
  const places = setResource<SavedPlace[]>(cacheKeys.places(tripId), (current) => current?.filter((place) => !removed.has(place.id)));
  if (places) await writeCache(cacheKeys.places(tripId), places);
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  await deleteCache(cacheKeys.itinerary(tripId));
  if (account !== getAccountScope()) return;
  void invalidateResource(cacheKeys.itinerary(tripId));
}
