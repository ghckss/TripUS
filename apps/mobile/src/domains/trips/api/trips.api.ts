import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, deleteCache, readCache, writeCache } from "@/shared/offline/cache";

export type Trip = components["schemas"]["TripResponseDto"];
export type CreateTripInput = components["schemas"]["CreateTripDto"];
export type UpdateTripInput = components["schemas"]["UpdateTripDto"];

export async function listTrips(): Promise<Trip[]> {
  return cachedRequest(cacheKeys.trips, async () => {
    const { data, error } = await tripUsApi.GET("/v1/trips");
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  });
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const { data, error } = await tripUsApi.POST("/v1/trips", { body: input });
  if (error) throw new Error(apiErrorMessage(error));
  const trips = await readCache<Trip[]>(cacheKeys.trips);
  if (trips) await writeCache(cacheKeys.trips, [data, ...trips.filter((trip) => trip.id !== data.id)]);
  await writeCache(cacheKeys.trip(data.id), data);
  return data;
}

export async function getTrip(tripId: string): Promise<Trip> {
  return cachedRequest(cacheKeys.trip(tripId), async () => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}", {
      params: { path: { tripId } },
    });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  });
}

export async function updateTrip(tripId: string, input: UpdateTripInput): Promise<Trip> {
  const { data, error } = await tripUsApi.PATCH("/v1/trips/{tripId}", {
    params: { path: { tripId } },
    body: input,
  });
  if (error) throw new Error(apiErrorMessage(error));
  await writeCache(cacheKeys.trip(tripId), data);
  const trips = await readCache<Trip[]>(cacheKeys.trips);
  if (trips) await writeCache(cacheKeys.trips, trips.map((trip) => trip.id === tripId ? data : trip));
  return data;
}

export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await tripUsApi.DELETE("/v1/trips/{tripId}", {
    params: { path: { tripId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  await deleteCache(cacheKeys.trip(tripId));
  await deleteCache(cacheKeys.places(tripId));
  await deleteCache(cacheKeys.itinerary(tripId));
  const trips = await readCache<Trip[]>(cacheKeys.trips);
  if (trips) await writeCache(cacheKeys.trips, trips.filter((trip) => trip.id !== tripId));
}
