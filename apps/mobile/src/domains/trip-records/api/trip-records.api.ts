import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import type { Itinerary } from "@/domains/itineraries/api/itineraries.api";
import type { Trip } from "@/domains/trips";

export type CompleteTripItem = components["schemas"]["CompleteTripItemDto"];

export async function completeTrip(tripId: string, items: CompleteTripItem[]): Promise<{ trip: Trip; itinerary: Itinerary }> {
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/completion", {
    params: { path: { tripId } }, body: { items },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

export async function listCompletedTrips(): Promise<Trip[]> {
  const { data, error } = await tripUsApi.GET("/v1/trips", { params: { query: { status: "completed" } } });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}
