import { tripUsApi } from "@/shared/api/trip-us-api";
import { deleteCache, writeCache } from "@/shared/offline/cache";
import { generateAiPlan, type AiPlanRequest, type Itinerary } from "./itineraries.api";

jest.mock("@/shared/api/trip-us-api", () => ({
  apiErrorMessage: (error: unknown) => String(error),
  tripUsApi: { GET: jest.fn(), POST: jest.fn() },
}));

jest.mock("@/shared/offline/cache", () => ({
  cacheKeys: {
    itinerary: (tripId: string) => `itinerary:${tripId}`,
    places: (tripId: string) => `places:${tripId}`,
    aiUndo: (tripId: string) => `undo:${tripId}`,
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

    const result = await generateAiPlan("trip-1", {
      density: "balanced",
      themes: ["highlights"],
      transportModes: ["public_transit"],
    } as AiPlanRequest);

    expect(result).toEqual(generated);
    expect(mockWriteCache).toHaveBeenCalledWith("itinerary:trip-1", generated);
    expect(mockWriteCache).toHaveBeenCalledWith("undo:trip-1", previous);
    expect(mockDeleteCache).toHaveBeenCalledWith("places:trip-1");
  });
});
