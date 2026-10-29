import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";

export type SavedPlace = components["schemas"]["SavedPlaceResponseDto"];
export type CreateSavedPlaceInput = components["schemas"]["CreateSavedPlaceDto"];
export type SavePlaceResult = components["schemas"]["SavePlaceResultDto"];

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
