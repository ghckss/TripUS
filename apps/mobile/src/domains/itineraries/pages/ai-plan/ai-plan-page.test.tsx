import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import AiPlanScreen from "./ai-plan-page";
import { AppDialogProvider } from "@/shared/ui/app-dialog";

const mockGenerate = jest.fn().mockResolvedValue(true);
let mockLatestRequest: {
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
      additionalRequests: "현지 맛집과 카페를 좋아하고 긴 대기는 피하고 싶어요.",
    };
  });

  it("loads and reuses the latest request saved for the trip", async () => {
    const screen = await render(<AppDialogProvider><AiPlanScreen /></AppDialogProvider>);

    await fireEvent.press(screen.getByLabelText("최근 요청 불러오기"));
    expect(screen.getByText("최근 설정을 불러올까요?")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("불러오기"));
    expect(screen.getByLabelText("추가 요청사항").props.value).toBe("현지 맛집과 카페를 좋아하고 긴 대기는 피하고 싶어요.");

    await fireEvent.press(screen.getByTestId("ai-plan-generate"));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith({
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

  it("only offers additional requests as an AI planning input", async () => {
    const screen = await render(<AppDialogProvider><AiPlanScreen /></AppDialogProvider>);

    expect(screen.getByText("원하시는 여행을 저에게 알려주세요")).toBeOnTheScreen();
    expect(screen.queryByText("TripUS")).not.toBeOnTheScreen();
    expect(screen.queryByText("여행의 밀도")).not.toBeOnTheScreen();
    expect(screen.queryByText("여행의 방식")).not.toBeOnTheScreen();
    expect(screen.queryByText("동행자")).not.toBeOnTheScreen();
    expect(screen.queryByText("이동 수단")).not.toBeOnTheScreen();
    expect(screen.queryByText("예산")).not.toBeOnTheScreen();
    expect(screen.getByText("추가 요청사항 (선택)")).toBeOnTheScreen();
    expect(screen.getByLabelText("추가 요청사항")).toBeOnTheScreen();
  });

  it("fills the request input without generating when an example is selected", async () => {
    const screen = await render(<AppDialogProvider><AiPlanScreen /></AppDialogProvider>);
    const label = "현지인처럼 여행하고 싶어요";
    const request = "유명 관광지는 최소화하고 현지인이 일상적으로 찾는 동네, 식당, 상점과 문화 공간을 중심으로 구성해 주세요.";

    expect(screen.getByText("쇼핑을 많이 하고 싶어요")).toBeOnTheScreen();
    expect(screen.getByText(label)).toBeOnTheScreen();
    expect(screen.getByText("도시보다 자연이 더 좋아요")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(`예시 요청: ${label}`));

    expect(screen.getByLabelText("추가 요청사항").props.value).toBe(request);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
