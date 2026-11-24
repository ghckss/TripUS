import { defineQuery, getAccountScope, invalidateResource, setResource } from "@/shared/query/query-client";
import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, deleteCache, readCache, writeCache } from "@/shared/offline/cache";
import { trackEvent } from "@/shared/telemetry/telemetry";

export type Itinerary = components["schemas"]["ItineraryResponseDto"];
export type ItineraryActivity = components["schemas"]["ItineraryActivityDto"];
export type ItineraryItem = components["schemas"]["ItineraryItemResponseDto"];
export type TravelTheme = components["schemas"]["TravelTheme"];
export type AiPlanRequest = components["schemas"]["GenerateAiPlanDto"];
export type AiTransportMode = components["schemas"]["AiTransportMode"];
export type AiBudgetLevel = components["schemas"]["AiBudgetLevel"];
export type ReplaceItineraryItem = components["schemas"]["ReplaceItineraryItemDto"];
export type TransitRouteRequest = components["schemas"]["TransitRouteRequestDto"];
export type TransitRoute = components["schemas"]["TransitRouteResponseDto"];
type AiPlanExecutionStatus = components["schemas"]["AiPlanExecutionStatusResponseDto"];

const GENERATION_POLL_MS = 2_000;
const GENERATION_TIMEOUT_MS = 30 * 60_000;

export function isItineraryBoundary(item: ItineraryItem): boolean {
  return item.boundaryType === "start_point" || item.boundaryType === "end_point";
}

export const getItinerary = defineQuery((tripId: string) => ({
  key: cacheKeys.itinerary(tripId), staleTime: 60000,
  request: async (): Promise<Itinerary> => {
    return cachedRequest(cacheKeys.itinerary(tripId), async () => {
      const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/itinerary", { params: { path: { tripId } } });
      if (error) throw new Error(apiErrorMessage(error));
      return data;
    });
  },
}));

async function getFreshItinerary(tripId: string): Promise<Itinerary> {
  const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/itinerary", { params: { path: { tripId } } });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

const getAiPlanExecutionStatus = defineQuery((tripId: string) => ({
  key: `trips:${tripId}:ai-status`, staleTime: 1000,
  request: async (): Promise<AiPlanExecutionStatus> => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/ai-plans/status", {
      params: { path: { tripId } },
    });
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  },
}));

async function waitForGeneration(
  tripId: string,
  generationId: string,
  previousItinerary: Itinerary,
): Promise<Itinerary> {
  const account = getAccountScope();
  const startedAt = Date.now();
  while (Date.now() - startedAt < GENERATION_TIMEOUT_MS) {
    try {
      const execution = await getAiPlanExecutionStatus(tripId);
      if (account !== getAccountScope()) throw new Error("Session changed during request");
      if (execution.generationId === generationId && execution.status === "generated") {
        const itinerary = await getFreshItinerary(tripId);
        if (account !== getAccountScope()) throw new Error("Session changed during request");
        setResource(cacheKeys.itinerary(tripId), itinerary);
        await deleteCache(cacheKeys.places(tripId));
        if (account !== getAccountScope()) throw new Error("Session changed during request");
        void invalidateResource(cacheKeys.places(tripId));
        await writeCache(cacheKeys.itinerary(tripId), itinerary);
        if (account !== getAccountScope()) throw new Error("Session changed during request");
        await writeCache(cacheKeys.aiUndo(tripId), previousItinerary);
        if (account !== getAccountScope()) throw new Error("Session changed during request");
        void invalidateResource("entitlements");
        trackEvent("ai_plan.generated", { tripId, generationId, itemCount: itinerary.items.length });
        return itinerary;
      }
      if (execution.generationId === generationId && execution.status === "conflict") {
        throw new Error("AI 일정에 충돌이 있어요. 일정 편집에서 다시 배치해 주세요.");
      }
      if (execution.generationId === generationId && execution.status === "unavailable") {
        throw new Error(execution.failureReason === "AI_GENERATION_LIMIT_REACHED"
          ? "무료 AI 일정 생성 횟수를 모두 사용했어요."
          : execution.failureReason === "timeout"
          ? "일정을 구성하지 못했어요. AI 응답 대기 시간을 초과했어요. 잠시 후 다시 시도해 주세요."
          : execution.failureReason === "output_limit"
            ? "일정을 구성하지 못했어요. AI 응답 분량 제한으로 생성이 중단됐어요."
            : "일정을 구성하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch (error) {
      if (account !== getAccountScope()) throw error;
      if (error instanceof Error && (error.message.startsWith("AI 일정에 충돌")
        || error.message.startsWith("일정을 구성하지 못했어요")
        || error.message.startsWith("무료 AI 일정 생성 횟수"))) {
        throw error;
      }
      // Keep the loading state through transient status polling failures.
    }
    await new Promise((resolve) => setTimeout(resolve, GENERATION_POLL_MS));
  }
  throw new Error("일정 생성이 예상보다 오래 걸리고 있어요. 잠시 후 다시 확인해 주세요.");
}

export async function generateAiPlan(tripId: string, request: AiPlanRequest): Promise<Itinerary> {
  const account = getAccountScope();
  const previous = await getItinerary(tripId);
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/ai-plans", {
    params: { path: { tripId } },
    body: request,
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  setResource(`trips:${tripId}:ai-request`, request);
  trackEvent("ai_plan.accepted", { tripId, generationId: data.generationId });
  return waitForGeneration(tripId, data.generationId, previous);
}

export async function generateAiPlanDay(tripId: string, date: string): Promise<Itinerary> {
  const account = getAccountScope();
  const previous = await getItinerary(tripId);
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/ai-plans/days/{date}", {
    params: { path: { tripId, date } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  trackEvent("ai_plan.day_accepted", { tripId, date, generationId: data.generationId });
  return waitForGeneration(tripId, data.generationId, previous);
}

export const getLatestAiPlanRequest = defineQuery((tripId: string) => ({
  key: `trips:${tripId}:ai-request`, staleTime: 300000,
  request: async (): Promise<AiPlanRequest | null> => {
    const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/ai-plans/latest-request", {
      params: { path: { tripId } },
    });
    if (error) throw new Error(apiErrorMessage(error));
    return data.request ?? null;
  },
}));

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
  })), previous.activities ?? []);
  await deleteCache(cacheKeys.aiUndo(tripId));
  return restored;
}

export async function replaceItinerary(
  tripId: string,
  items: ReplaceItineraryItem[],
  activities?: ItineraryActivity[],
): Promise<Itinerary> {
  const account = getAccountScope();
  const { data, error } = await tripUsApi.PUT("/v1/trips/{tripId}/itinerary", {
    params: { path: { tripId } },
    body: { items, ...(activities !== undefined ? { activities: activities.map(serializeActivity) } : {}) },
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  if (data.status === "conflict") throw new Error(`일정 충돌: ${data.conflicts.join(", ")}`);
  setResource(cacheKeys.itinerary(tripId), data.itinerary);
  await writeCache(cacheKeys.itinerary(tripId), data.itinerary);
  return data.itinerary;
}

// Older undo/offline snapshots may include retired fields; send only the current contract.
function serializeActivity(activity: ItineraryActivity): ItineraryActivity {
  const { id, date, position, type, title, startTime, durationMinutes, locationType,
    savedPlaceId, locationName, fromLocation, toLocation, travelMethod } = activity;
  return { id, date, position, type, title, startTime, durationMinutes, locationType,
    savedPlaceId, locationName, fromLocation, toLocation, travelMethod };
}

export async function getTransitRoute(
  tripId: string,
  originSavedPlaceId: string,
  destinationSavedPlaceId: string,
): Promise<TransitRoute> {
  return getTransitLeg(tripId, { originSavedPlaceId, destinationSavedPlaceId });
}

export async function getTransitLeg(tripId: string, request: TransitRouteRequest): Promise<TransitRoute> {
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/routes/transit", {
    params: { path: { tripId } },
    body: request,
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}
