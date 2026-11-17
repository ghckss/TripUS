import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import AiPlanScreen from "./ai-plan-page";
import { AppDialogProvider } from "@/shared/ui/app-dialog";

const mockGenerate = jest.fn().mockResolvedValue(true);
let mockLatestRequest: {
  themes: ["food", "cafes"];
  companions: string;
  transportModes: ["public_transit", "walking"];
  budgetLevel: "premium";
  additionalRequests: string;
} | null;

jest.mock("expo-router", () => ({
  usePreventRemove: () => jest.fn(),
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
      themes: ["food", "cafes"],
      companions: "친구 2명",
      transportModes: ["public_transit", "walking"],
      budgetLevel: "premium",
      additionalRequests: "현지 맛집과 카페를 좋아하고 긴 대기는 피하고 싶어요.",
    };
  });

  it("loads and reuses the latest request saved for the trip", async () => {
    const screen = await render(<AppDialogProvider><AiPlanScreen /></AppDialogProvider>);

    await fireEvent.press(screen.getByLabelText("최근 요청 불러오기"));
    expect(screen.getByText("최근 설정을 불러올까요?")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("불러오기"));
    expect(screen.getByLabelText("동행자").props.value).toBe("친구 2명");
    expect(screen.getByLabelText("추가 요청사항").props.value).toBe("현지 맛집과 카페를 좋아하고 긴 대기는 피하고 싶어요.");

    await fireEvent.press(screen.getByTestId("ai-plan-generate"));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith({
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
    const screen = await render(<AppDialogProvider><AiPlanScreen /></AppDialogProvider>);

    await fireEvent.press(screen.getByLabelText("최근 요청 불러오기"));

    expect(screen.getByText("불러올 최근 요청이 없어요")).toBeOnTheScreen();
  });

  it("explains travel themes and budget without offering density choices", async () => {
    const screen = await render(<AppDialogProvider><AiPlanScreen /></AppDialogProvider>);

    expect(screen.queryByText("여행의 밀도")).not.toBeOnTheScreen();
    expect(screen.queryByLabelText("여행의 밀도 선택지 설명")).not.toBeOnTheScreen();
    expect(screen.queryByText("균형 있게")).not.toBeOnTheScreen();
    expect(screen.queryByText("알차게")).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("여행의 방식 선택지 설명"));
    expect(screen.getByText(/자연·휴식: 공원과 자연/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("확인"));
    await fireEvent.press(screen.getByLabelText("예산 선택지 설명"));
    expect(screen.getByText(/가성비: 비용 부담이 적은/)).toBeOnTheScreen();
  });
});
