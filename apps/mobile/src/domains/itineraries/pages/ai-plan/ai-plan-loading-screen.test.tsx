import { act, render } from "@testing-library/react-native";

import { AiPlanLoadingScreen } from "./ai-plan-loading-screen";

jest.useFakeTimers();

describe("AiPlanLoadingScreen", () => {
  it("explains the current generation step and advances the message", async () => {
    const screen = await render(<AiPlanLoadingScreen />);

    expect(screen.getByTestId("ai-plan-loading")).toBeTruthy();
    expect(screen.getByText("저장한 장소를 살펴보고 있어요")).toBeTruthy();

    await act(() => { jest.advanceTimersByTime(3500); });

    expect(screen.getByText("가까운 장소끼리 묶고 있어요")).toBeTruthy();
  });
});
