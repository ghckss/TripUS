import { defineQuery, getAccountScope, invalidateResource, queryClient, removeResources, setResource } from "@/shared/query/query-client";
import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, deleteCache, readCache, writeCache } from "@/shared/offline/cache";
import { trackEvent } from "@/shared/telemetry/telemetry";

export type Trip = components["schemas"]["TripResponseDto"];
export type CreateTripInput = components["schemas"]["CreateTripDto"];
export type UpdateTripInput = components["schemas"]["UpdateTripDto"];

export const listTrips = defineQuery(() => ({
  key: cacheKeys.trips, staleTime: 60000,
  request: async (): Promise<Trip[]> => {
    return cachedRequest(cacheKeys.trips, async () => {
      const { data, error } = await tripUsApi.GET("/v1/trips");
      if (error) throw new Error(apiErrorMessage(error));
      return data;
    });
  },
}));

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const account = getAccountScope();
  const { data, error } = await tripUsApi.POST("/v1/trips", { body: input });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  await updateTripResources(data, true);
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  void invalidateResource("entitlements");
  trackEvent("trip.created", { tripId: data.id, destination: data.destination });
  return data;
}

export const getTrip = defineQuery((tripId: string) => ({
  key: cacheKeys.trip(tripId), staleTime: 60000,
  request: async (): Promise<Trip> => {
    return cachedRequest(cacheKeys.trip(tripId), async () => {
      const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}", {
        params: { path: { tripId } },
      });
      if (error) throw new Error(apiErrorMessage(error));
      return data;
    });
  },
}));

export async function updateTrip(tripId: string, input: UpdateTripInput): Promise<Trip> {
  const account = getAccountScope();
  const previous = queryClient.getQueryData<Trip>(getTrip.options(tripId).queryKey);
  const { data, error } = await tripUsApi.PATCH("/v1/trips/{tripId}", {
    params: { path: { tripId } },
    body: input,
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  await updateTripResources(data);
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  await deleteCache(cacheKeys.itinerary(tripId));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  void invalidateResource(cacheKeys.itinerary(tripId));
  if (JSON.stringify(previous?.regions?.[0]) !== JSON.stringify(data.regions?.[0])) removeResources(`trips:${tripId}:cover`);
  return data;
}

export async function deleteTrip(tripId: string): Promise<void> {
  const account = getAccountScope();
  const { error } = await tripUsApi.DELETE("/v1/trips/{tripId}", {
    params: { path: { tripId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) return;
  const [storedTrips, storedCompleted] = await Promise.all([
    readCache<Trip[]>(cacheKeys.trips), readCache<Trip[]>(cacheKeys.completedTrips),
  ]);
  if (account !== getAccountScope()) return;
  removeResources(`trips:${tripId}`);
  const trips = setResource<Trip[]>(cacheKeys.trips, (current) => current?.filter((trip) => trip.id !== tripId))
    ?? storedTrips?.filter((trip) => trip.id !== tripId);
  const completed = setResource<Trip[]>(cacheKeys.completedTrips, (current) => current?.filter((trip) => trip.id !== tripId))
    ?? storedCompleted?.filter((trip) => trip.id !== tripId);
  await Promise.all([
    deleteCache(cacheKeys.aiUndo(tripId)), deleteCache(cacheKeys.trip(tripId)),
    deleteCache(cacheKeys.places(tripId)), deleteCache(cacheKeys.itinerary(tripId)),
    ...(trips ? [writeCache(cacheKeys.trips, trips)] : []),
    ...(completed ? [writeCache(cacheKeys.completedTrips, completed)] : []),
  ]);
  if (account !== getAccountScope()) return;
  void invalidateResource("entitlements");
  trackEvent("trip.deleted", { tripId });
}

export const getTripCover = defineQuery((tripId: string) => ({
  key: `trips:${tripId}:cover`, staleTime: 300000,
  request: async (): Promise<components["schemas"]["PlacePhotoResponseDto"]> => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/cover", { params: { path: { tripId } } });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  },
}));

export async function updateTripResources(trip: Trip, created = false) {
  const upsert = (current: Trip[]) => current.some((item) => item.id === trip.id)
    ? current.map((item) => item.id === trip.id ? trip : item)
    : [trip, ...current];
  setResource(cacheKeys.trip(trip.id), trip);
  const active = setResource<Trip[]>(cacheKeys.trips, (current) => current
    ? trip.archivedAt ? current.filter((item) => item.id !== trip.id)
      : created ? [trip, ...current.filter((item) => item.id !== trip.id)] : current.map((item) => item.id === trip.id ? trip : item)
    : undefined);
  const completed = setResource<Trip[]>(cacheKeys.completedTrips, (current) => current
    ? trip.archivedAt ? upsert(current) : current.filter((item) => item.id !== trip.id)
    : undefined);
  await Promise.all([writeCache(cacheKeys.trip(trip.id), trip),
    ...(active ? [writeCache(cacheKeys.trips, active)] : []),
    ...(completed ? [writeCache(cacheKeys.completedTrips, completed)] : [])]);
}
