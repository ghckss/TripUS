import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";

export type Trip = components["schemas"]["TripResponseDto"];
export type CreateTripInput = components["schemas"]["CreateTripDto"];

export async function listTrips(): Promise<Trip[]> {
  const { data, error } = await tripUsApi.GET("/v1/trips");
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const { data, error } = await tripUsApi.POST("/v1/trips", { body: input });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

export async function getTrip(tripId: string): Promise<Trip> {
  const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}", {
    params: { path: { tripId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}
