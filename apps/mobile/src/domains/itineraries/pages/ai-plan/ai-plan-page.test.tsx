import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import AiPlanScreen from "./ai-plan-page";

const mockGenerate = jest.fn().mockResolvedValue(true);

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
}));
jest.mock("./use-ai-plan", () => ({
  useAiPlan: () => ({
    entitlements: { tier: "pro", aiGenerationsUsed: 0 },
    error: undefined,
    generate: mockGenerate,
    latestRequest: {
      style: "food",
      companions: "친구 2명",
      transportMode: "mixed",
      budgetLevel: "premium",
      preferences: "현지 맛집과 카페",
      avoidances: "긴 대기",
    },
    loading: false,
    missingRegions: false,
  }),
}));

describe("AiPlanScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("loads and reuses the latest request saved for the trip", async () => {
    const screen = await render(<AiPlanScreen />);

    await fireEvent.press(screen.getByText("최근 요청 불러오기"));
    expect(screen.getByLabelText("동행자").props.value).toBe("친구 2명");
    expect(screen.getByLabelText("좋아하는 것").props.value).toBe("현지 맛집과 카페");
    expect(screen.getByLabelText("피하고 싶은 것").props.value).toBe("긴 대기");

    await fireEvent.press(screen.getByTestId("ai-plan-generate"));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith({
      style: "food",
      companions: "친구 2명",
      transportMode: "mixed",
      budgetLevel: "premium",
      preferences: "현지 맛집과 카페",
      avoidances: "긴 대기",
    }));
    expect(router.replace).toHaveBeenCalledWith("/trips/trip-1/itinerary");
  });
});
