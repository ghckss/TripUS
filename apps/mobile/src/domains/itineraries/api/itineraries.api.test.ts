import { tripUsApi } from "@/shared/api/trip-us-api";
import { deleteCache, readCache, writeCache } from "@/shared/offline/cache";
import { generateAiPlan, undoAiPlan, type AiPlanRequest, type Itinerary } from "./itineraries.api";

jest.mock("@/shared/api/trip-us-api", () => ({
  apiErrorMessage: (error: unknown) => String(error),
  tripUsApi: { GET: jest.fn(), POST: jest.fn(), PUT: jest.fn() },
}));

jest.mock("@/shared/offline/cache", () => ({
  cacheKeys: {
    itinerary: (tripId: string) => `itinerary:${tripId}`,
    places: (tripId: string) => `places:${tripId}`,
    aiUndo: (tripId: string) => `undo:${tripId}`,
    aiRequest: (tripId: string) => `request:${tripId}`,
  },
  cachedRequest: (_key: string, request: () => Promise<unknown>) => request(),
  deleteCache: jest.fn(),
  readCache: jest.fn(),
  writeCache: jest.fn(),
}));

jest.mock("@/shared/telemetry/telemetry", () => ({ trackEvent: jest.fn() }));

const mockGet = tripUsApi.GET as jest.Mock;
const mockPost = tripUsApi.POST as jest.Mock;
const mockWriteCache = writeCache as jest.Mock;
const mockDeleteCache = deleteCache as jest.Mock;

describe("generateAiPlan", () => {
  it("reports output exhaustion separately and keeps the old itinerary", async () => {
    mockGet.mockImplementation((path: string) => Promise.resolve({ data: path.endsWith("/status")
      ? { generationId: "limit-job", status: "unavailable", failureReason: "output_limit" }
      : { items: [], unplaced: [] } }));
    mockPost.mockResolvedValue({ data: { generationId: "limit-job", status: "running" } });
    await expect(generateAiPlan("trip-1", {} as AiPlanRequest))
      .rejects.toThrow("AI 응답 분량 제한으로 생성이 중단됐어요");
    expect(mockWriteCache).not.toHaveBeenCalled();
  });

  it("shows a timeout reason without replacing the previous itinerary", async () => {
    mockGet.mockImplementation((path: string) => Promise.resolve({ data: path.endsWith("/status")
      ? { generationId: "timeout-job", status: "unavailable", failureReason: "timeout" }
      : { items: [], unplaced: [] } }));
    mockPost.mockResolvedValue({ data: { generationId: "timeout-job", status: "running" } });
    await expect(generateAiPlan("trip-1", {} as AiPlanRequest))
      .rejects.toThrow("AI 응답 대기 시간을 초과했어요");
    expect(mockWriteCache).not.toHaveBeenCalled();
  });

  it("shows the plan limit message returned by a background generation", async () => {
    mockGet.mockImplementation((path: string) => Promise.resolve({ data: path.endsWith("/status")
      ? { generationId: "plan-limit-job", status: "unavailable", failureReason: "AI_GENERATION_LIMIT_REACHED" }
      : { items: [], unplaced: [] } }));
    mockPost.mockResolvedValue({ data: { generationId: "plan-limit-job", status: "running" } });
    await expect(generateAiPlan("trip-1", {} as AiPlanRequest))
      .rejects.toThrow("무료 AI 일정 생성 횟수를 모두 사용했어요");
    expect(mockWriteCache).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("waits for an accepted generation job and loads the completed itinerary", async () => {
    const previous = { items: [], unplaced: [] } as Itinerary;
    const generated = {
      items: [{
        id: "item-1",
        savedPlaceId: "place-1",
        placeName: "예류지질공원",
        locked: false,
        source: "ai",
      }],
      unplaced: [],
    } as Itinerary;
    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/itinerary")) {
        const data = mockGet.mock.calls.filter(([calledPath]) => String(calledPath).endsWith("/itinerary")).length === 1
          ? previous
          : generated;
        return Promise.resolve({ data });
      }
      if (path.endsWith("/status")) {
        return Promise.resolve({ data: { generationId: "new-generation", status: "generated", failureReason: null } });
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    mockPost.mockResolvedValue({ data: { generationId: "new-generation", status: "running" } });

    const result = await generateAiPlan("trip-1", {} as AiPlanRequest);

    expect(result).toEqual(generated);
    expect(mockWriteCache).toHaveBeenCalledWith("itinerary:trip-1", generated);
    expect(mockWriteCache).toHaveBeenCalledWith("undo:trip-1", previous);
    expect(mockDeleteCache).toHaveBeenCalledWith("places:trip-1");
  });
});


describe("undoAiPlan activities", () => {
  it("restores activities from an old offline snapshot without retired explanation fields", async () => {
    const activities = [{ id: "arrival", date: "2026-12-01", type: "arrival", startTime: "12:00", durationMinutes: 90 }];
    (readCache as jest.Mock).mockResolvedValue({ items: [], unplaced: [], activities: activities.map((item) => ({ ...item, reason: "old generated explanation" })) });
    (tripUsApi.PUT as jest.Mock).mockResolvedValue({ data: { status: "updated", itinerary: { items: [], unplaced: [], activities } } });
    await undoAiPlan("trip-1");
    expect(tripUsApi.PUT).toHaveBeenCalledWith("/v1/trips/{tripId}/itinerary", {
      params: { path: { tripId: "trip-1" } }, body: { items: [], activities },
    });
  });
});
