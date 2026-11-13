import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, deleteCache, readCache, writeCache } from "@/shared/offline/cache";
import { trackEvent } from "@/shared/telemetry/telemetry";

export type Itinerary = components["schemas"]["ItineraryResponseDto"];
export type ItineraryItem = components["schemas"]["ItineraryItemResponseDto"];
export type TravelDensity = components["schemas"]["TravelDensity"];
export type TravelTheme = components["schemas"]["TravelTheme"];
export type AiPlanRequest = components["schemas"]["GenerateAiPlanDto"];
export type AiTransportMode = components["schemas"]["AiTransportMode"];
export type AiBudgetLevel = components["schemas"]["AiBudgetLevel"];
export type ReplaceItineraryItem = components["schemas"]["ReplaceItineraryItemDto"];
export type TransitRoute = components["schemas"]["TransitRouteResponseDto"];

export function isItineraryBoundary(item: ItineraryItem): boolean {
  return item.boundaryType === "start_point" || item.boundaryType === "end_point";
}

export async function getItinerary(tripId: string): Promise<Itinerary> {
  return cachedRequest(cacheKeys.itinerary(tripId), async () => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/itinerary", { params: { path: { tripId } } });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  });
}

export async function generateAiPlan(tripId: string, request: AiPlanRequest): Promise<Itinerary> {
  const previous = await getItinerary(tripId);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/ai-plans", {
      params: { path: { tripId } },
      body: request,
    });
    if (error) throw new Error(apiErrorMessage(error));
    if (data.status === "conflict") throw new Error("AI 일정에 충돌이 있어요. 일정 편집에서 다시 배치해 주세요.");
    if (data.status === "unavailable") {
      trackEvent("ai_plan.internal_retry", { tripId, attempt, reason: data.failureReason ?? "unknown" });
      continue;
    }
    await deleteCache(cacheKeys.places(tripId));
    await writeCache(cacheKeys.itinerary(tripId), data.itinerary);
    await writeCache(cacheKeys.aiUndo(tripId), previous);
    trackEvent("ai_plan.generated", { tripId, density: request.density, themes: request.themes.join(","), itemCount: data.itinerary.items.length });
    return data.itinerary;
  }
  throw new Error("일정을 구성하는 데 시간이 더 필요해요. 잠시 후 자동으로 다시 시도해 주세요.");
}

export async function generateAiPlanDay(tripId: string, date: string): Promise<Itinerary> {
  const previous = await getItinerary(tripId);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/ai-plans/days/{date}", {
      params: { path: { tripId, date } },
    });
    if (error) throw new Error(apiErrorMessage(error));
    if (data.status === "conflict") throw new Error("해당 날짜 일정을 다시 구성하지 못했어요.");
    if (data.status === "unavailable") {
      trackEvent("ai_plan.day_internal_retry", { tripId, date, attempt, reason: data.failureReason ?? "unknown" });
      continue;
    }
    await deleteCache(cacheKeys.places(tripId));
    await writeCache(cacheKeys.itinerary(tripId), data.itinerary);
    await writeCache(cacheKeys.aiUndo(tripId), previous);
    trackEvent("ai_plan.day_generated", { tripId, date, itemCount: data.itinerary.items.length });
    return data.itinerary;
  }
  throw new Error("해당 날짜 일정을 구성하는 데 시간이 더 필요해요. 잠시 후 다시 시도해 주세요.");
}

export async function getLatestAiPlanRequest(tripId: string): Promise<AiPlanRequest | null> {
  const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/ai-plans/latest-request", {
    params: { path: { tripId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data.request ?? null;
}

export async function undoAiPlan(tripId: string): Promise<Itinerary | undefined> {
  const previous = await readCache<Itinerary>(cacheKeys.aiUndo(tripId));
  if (!previous) return undefined;
  const restored = await replaceItinerary(tripId, previous.items.filter((item) => !isItineraryBoundary(item)).map((item) => ({
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
