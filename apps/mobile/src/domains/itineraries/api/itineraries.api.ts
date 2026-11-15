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
type AiPlanExecutionStatus = components["schemas"]["AiPlanExecutionStatusResponseDto"];

const GENERATION_POLL_MS = 2_000;
const GENERATION_TIMEOUT_MS = 30 * 60_000;

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

async function getFreshItinerary(tripId: string): Promise<Itinerary> {
  const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/itinerary", { params: { path: { tripId } } });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

async function getAiPlanExecutionStatus(tripId: string): Promise<AiPlanExecutionStatus> {
  const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/ai-plans/status", {
    params: { path: { tripId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

async function waitForGeneration(
  tripId: string,
  generationId: string,
  previousItinerary: Itinerary,
): Promise<Itinerary> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < GENERATION_TIMEOUT_MS) {
    try {
      const execution = await getAiPlanExecutionStatus(tripId);
      if (execution.generationId === generationId && execution.status === "generated") {
        const itinerary = await getFreshItinerary(tripId);
        await deleteCache(cacheKeys.places(tripId));
        await writeCache(cacheKeys.itinerary(tripId), itinerary);
        await writeCache(cacheKeys.aiUndo(tripId), previousItinerary);
        trackEvent("ai_plan.generated", { tripId, generationId, itemCount: itinerary.items.length });
        return itinerary;
      }
      if (execution.generationId === generationId && execution.status === "conflict") {
        throw new Error("AI 일정에 충돌이 있어요. 일정 편집에서 다시 배치해 주세요.");
      }
      if (execution.generationId === generationId && execution.status === "unavailable") {
        throw new Error("일정을 구성하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch (error) {
      if (error instanceof Error && (error.message.startsWith("AI 일정에 충돌") || error.message.startsWith("일정을 구성하지 못했어요"))) {
        throw error;
      }
      // Keep the loading state through transient status polling failures.
    }
    await new Promise((resolve) => setTimeout(resolve, GENERATION_POLL_MS));
  }
  throw new Error("일정 생성이 예상보다 오래 걸리고 있어요. 잠시 후 다시 확인해 주세요.");
}

export async function generateAiPlan(tripId: string, request: AiPlanRequest): Promise<Itinerary> {
  const previous = await getItinerary(tripId);
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/ai-plans", {
    params: { path: { tripId } },
    body: request,
  });
  if (error) throw new Error(apiErrorMessage(error));
  trackEvent("ai_plan.accepted", { tripId, generationId: data.generationId });
  return waitForGeneration(tripId, data.generationId, previous);
}

export async function generateAiPlanDay(tripId: string, date: string): Promise<Itinerary> {
  const previous = await getItinerary(tripId);
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/ai-plans/days/{date}", {
    params: { path: { tripId, date } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  trackEvent("ai_plan.day_accepted", { tripId, date, generationId: data.generationId });
  return waitForGeneration(tripId, data.generationId, previous);
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
