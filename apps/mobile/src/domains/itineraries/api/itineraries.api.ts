import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, writeCache } from "@/shared/offline/cache";
import { trackEvent } from "@/shared/telemetry/telemetry";

export type Itinerary = components["schemas"]["ItineraryResponseDto"];
export type ItineraryItem = components["schemas"]["ItineraryItemResponseDto"];
export type TravelStyle = components["schemas"]["TravelStyle"];
export type TransitRoute = components["schemas"]["TransitRouteResponseDto"];

export async function getItinerary(tripId: string): Promise<Itinerary> {
  return cachedRequest(cacheKeys.itinerary(tripId), async () => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/itinerary", { params: { path: { tripId } } });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  });
}

export async function generateAiPlan(tripId: string, style: TravelStyle): Promise<Itinerary> {
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/ai-plans", {
    params: { path: { tripId } },
    body: { style },
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (data.status === "conflict") throw new Error("AI 일정에 충돌이 있어요. 일정 편집에서 다시 배치해 주세요.");
  if (data.status === "unavailable") throw new Error("AI 일정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  await writeCache(cacheKeys.itinerary(tripId), data.itinerary);
  trackEvent("ai_plan.generated", { tripId, style, itemCount: data.itinerary.items.length });
  return data.itinerary;
}

export async function replaceItinerary(
  tripId: string,
  items: { savedPlaceId: string; date: string; position: number; locked: boolean }[],
): Promise<Itinerary> {
  const { data, error } = await tripUsApi.PUT("/v1/trips/{tripId}/itinerary", {
    params: { path: { tripId } },
    body: { items },
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (data.status === "conflict") throw new Error(`일정 충돌: ${data.conflicts.join(", ")}`);
  await writeCache(cacheKeys.itinerary(tripId), data.itinerary);
  return data.itinerary;
}

export async function getTransitRoute(
  tripId: string,
  originSavedPlaceId: string,
  destinationSavedPlaceId: string,
): Promise<TransitRoute> {
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/routes/transit", {
    params: { path: { tripId } },
    body: { originSavedPlaceId, destinationSavedPlaceId },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}
