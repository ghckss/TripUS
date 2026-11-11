import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, deleteCache, readCache, writeCache } from "@/shared/offline/cache";
import { trackEvent } from "@/shared/telemetry/telemetry";

export type Itinerary = components["schemas"]["ItineraryResponseDto"];
export type ItineraryItem = components["schemas"]["ItineraryItemResponseDto"];
export type TravelStyle = components["schemas"]["TravelStyle"];
export type AiPlanRequest = components["schemas"]["GenerateAiPlanDto"];
export type AiTransportMode = components["schemas"]["AiTransportMode"];
export type AiBudgetLevel = components["schemas"]["AiBudgetLevel"];
export type ReplaceItineraryItem = components["schemas"]["ReplaceItineraryItemDto"];
export type TransitRoute = components["schemas"]["TransitRouteResponseDto"];

export async function getItinerary(tripId: string): Promise<Itinerary> {
  return cachedRequest(cacheKeys.itinerary(tripId), async () => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/itinerary", { params: { path: { tripId } } });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  });
}

export async function generateAiPlan(tripId: string, request: AiPlanRequest): Promise<Itinerary> {
  const previous = await getItinerary(tripId);
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/ai-plans", {
    params: { path: { tripId } },
    body: request,
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (data.status === "conflict") throw new Error("AI 일정에 충돌이 있어요. 일정 편집에서 다시 배치해 주세요.");
  if (data.status === "unavailable") {
    const message = data.failureReason === "invalid_output"
      ? "동선이나 상세 정보가 충분하지 않아 일정을 적용하지 않았어요. 다시 생성해 주세요."
      : "AI 일정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.";
    throw new Error(message);
  }
  await writeCache(cacheKeys.itinerary(tripId), data.itinerary);
  await writeCache(cacheKeys.aiUndo(tripId), previous);
  trackEvent("ai_plan.generated", { tripId, style: request.style, itemCount: data.itinerary.items.length });
  return data.itinerary;
}

export async function undoAiPlan(tripId: string): Promise<Itinerary | undefined> {
  const previous = await readCache<Itinerary>(cacheKeys.aiUndo(tripId));
  if (!previous) return undefined;
  const restored = await replaceItinerary(tripId, previous.items.map((item) => ({
    savedPlaceId: item.savedPlaceId,
    date: item.date!,
    position: item.position!,
    locked: item.locked,
    ...(item.scheduledTime ? { scheduledTime: item.scheduledTime } : {}),
    ...(item.durationMinutes ? { durationMinutes: item.durationMinutes } : {}),
    ...(item.activitySummary ? { activitySummary: item.activitySummary } : {}),
    ...(item.travelMethod ? { travelMethod: item.travelMethod } : {}),
    ...(item.travelDurationMinutes != null ? { travelDurationMinutes: item.travelDurationMinutes } : {}),
  })));
  await deleteCache(cacheKeys.aiUndo(tripId));
  return restored;
}

export async function replaceItinerary(
  tripId: string,
  items: ReplaceItineraryItem[],
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
