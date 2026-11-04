import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";

export type SavedPlace = components["schemas"]["SavedPlaceResponseDto"];
export type CreateSavedPlaceInput = components["schemas"]["CreateSavedPlaceDto"];
export type SavePlaceResult = components["schemas"]["SavePlaceResultDto"];
export type PlaceSearchCandidate = components["schemas"]["PlaceSearchCandidateDto"];
export type UpdateSavedPlaceInput = components["schemas"]["UpdateSavedPlaceDto"];

export async function listPlaces(tripId: string): Promise<SavedPlace[]> {
  const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/places", {
    params: { path: { tripId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
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
  return data;
}

export async function searchPlaces(tripId: string, query: string): Promise<PlaceSearchCandidate[]> {
  const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/places/search", {
    params: { path: { tripId }, query: { query } },
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
  return data;
}

export async function deletePlace(tripId: string, placeId: string): Promise<void> {
  const { error } = await tripUsApi.DELETE("/v1/trips/{tripId}/places/{placeId}", {
    params: { path: { tripId, placeId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
}
