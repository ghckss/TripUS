import { updateTripResources } from "@/domains/trips";
import { cachedRequest, cacheKeys, writeCache } from "@/shared/offline/cache";
import { defineQuery, getAccountScope, setResource } from "@/shared/query/query-client";
import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import type { Itinerary } from "@/domains/itineraries";
import type { Trip } from "@/domains/trips";
import { trackEvent } from "@/shared/telemetry/telemetry";

export type CompleteTripItem = components["schemas"]["CompleteTripItemDto"];

export async function completeTrip(tripId: string, items: CompleteTripItem[]): Promise<{ trip: Trip; itinerary: Itinerary }> {
  const account = getAccountScope();
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/completion", {
    params: { path: { tripId } }, body: { items },
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  await updateTripResources(data.trip);
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  setResource(cacheKeys.itinerary(tripId), data.itinerary);
  await writeCache(cacheKeys.itinerary(tripId), data.itinerary);
  trackEvent("trip.completed", { tripId, itemCount: items.length });
  return data;
}

export const listCompletedTrips = defineQuery(() => ({
  key: cacheKeys.completedTrips, staleTime: 300000,
  request: async (): Promise<Trip[]> => {
    return cachedRequest(cacheKeys.completedTrips, async () => {
      const { data, error } = await tripUsApi.GET("/v1/trips", { params: { query: { status: "completed" } } });
      if (error) throw new Error(apiErrorMessage(error));
      return data;
    });
  },
}));
