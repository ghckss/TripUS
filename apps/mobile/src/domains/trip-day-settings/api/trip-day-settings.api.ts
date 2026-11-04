import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, writeCache } from "@/shared/offline/cache";

export type TripDaySetting = components["schemas"]["TripDaySettingResponseDto"];
export type TripDaySettingInput = components["schemas"]["TripDaySettingInputDto"];

export async function getTripDaySettings(tripId: string): Promise<TripDaySetting[]> {
  return cachedRequest(cacheKeys.daySettings(tripId), async () => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/day-settings", { params: { path: { tripId } } });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  });
}

export async function replaceTripDaySettings(tripId: string, settings: TripDaySettingInput[]): Promise<TripDaySetting[]> {
  const { data, error } = await tripUsApi.PUT("/v1/trips/{tripId}/day-settings", {
    params: { path: { tripId } },
    body: { settings },
  });
  if (error) throw new Error(apiErrorMessage(error));
  await writeCache(cacheKeys.daySettings(tripId), data);
  return data;
}
