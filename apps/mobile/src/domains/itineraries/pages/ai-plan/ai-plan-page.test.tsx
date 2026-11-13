import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert } from "react-native";

import AiPlanScreen from "./ai-plan-page";

const mockGenerate = jest.fn().mockResolvedValue(true);
let mockLatestRequest: {
  density: "busy";
  themes: ["food", "cafes"];
  companions: string;
  transportModes: ["public_transit", "walking"];
  budgetLevel: "premium";
  additionalRequests: string;
} | null;

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
}));
jest.mock("./use-ai-plan", () => ({
  useAiPlan: () => ({
    entitlements: { tier: "pro", aiGenerationsUsed: 0 },
    error: undefined,
    generate: mockGenerate,
    latestRequest: mockLatestRequest,
    loading: false,
    missingRegions: false,
  }),
}));

describe("AiPlanScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatestRequest = {
      density: "busy",
      themes: ["food", "cafes"],
      companions: "친구 2명",
      transportModes: ["public_transit", "walking"],
      budgetLevel: "premium",
      additionalRequests: "현지 맛집과 카페를 좋아하고 긴 대기는 피하고 싶어요.",
    };
  });

  it("loads and reuses the latest request saved for the trip", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === "불러오기")?.onPress?.();
    });
    const screen = await render(<AiPlanScreen />);

    await fireEvent.press(screen.getByLabelText("최근 요청 불러오기"));
    expect(alert).toHaveBeenCalledWith(
      "최근 설정을 불러올까요?",
      expect.any(String),
      expect.any(Array),
    );
    expect(screen.getByLabelText("동행자").props.value).toBe("친구 2명");
    expect(screen.getByLabelText("추가 요청사항").props.value).toBe("현지 맛집과 카페를 좋아하고 긴 대기는 피하고 싶어요.");

    await fireEvent.press(screen.getByTestId("ai-plan-generate"));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith({
      density: "busy",
      themes: ["food", "cafes"],
      companions: "친구 2명",
      transportModes: ["public_transit", "walking"],
      budgetLevel: "premium",
      additionalRequests: "현지 맛집과 카페를 좋아하고 긴 대기는 피하고 싶어요.",
    }));
    expect(router.replace).toHaveBeenCalledWith("/trips/trip-1/itinerary");
  });

  it("explains when there is no latest request to load", async () => {
    mockLatestRequest = null;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const screen = await render(<AiPlanScreen />);

    await fireEvent.press(screen.getByLabelText("최근 요청 불러오기"));

    expect(alert).toHaveBeenCalledWith(
      "불러올 최근 요청이 없어요",
      "AI 일정을 한 번 만들면 다음 요청부터 최근 설정을 불러올 수 있어요.",
    );
  });
});
