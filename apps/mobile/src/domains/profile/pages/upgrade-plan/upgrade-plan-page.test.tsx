import { fireEvent, render } from "@testing-library/react-native";

import UpgradePlanScreen from "./upgrade-plan-page";
import { useUpgradePlan } from "./use-upgrade-plan";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("./use-upgrade-plan", () => ({ useUpgradePlan: jest.fn() }));

const mockUseUpgradePlan = jest.mocked(useUpgradePlan);

describe("UpgradePlanScreen", () => {
  it("starts a local Plus upgrade when mock billing is available", async () => {
    const upgrade = jest.fn();
    mockUseUpgradePlan.mockReturnValue({
      entitlements: { tier: "free", tripLimit: 1, tripCount: 1, aiGenerationLimit: 1, aiGenerationsUsed: 1, upgradeMode: "mock" },
      error: undefined,
      loading: false,
      upgrade,
      upgrading: false,
    });
    const screen = await render(<UpgradePlanScreen />);

    await fireEvent.press(screen.getByTestId("upgrade-plan-submit"));

    expect(upgrade).toHaveBeenCalledTimes(1);
    expect(screen.getByText("테스트 환경에서는 실제 결제 없이 Plus 전환만 검증합니다.")).toBeTruthy();
  });

  it("shows the applied Plus state", async () => {
    mockUseUpgradePlan.mockReturnValue({
      entitlements: { tier: "plus", tripLimit: null, tripCount: 3, aiGenerationLimit: null, aiGenerationsUsed: 4, upgradeMode: "mock" },
      error: undefined,
      loading: false,
      upgrade: jest.fn(),
      upgrading: false,
    });

    const screen = await render(<UpgradePlanScreen />);

    expect(screen.getByText("Plus 업그레이드가 완료됐어요")).toBeTruthy();
  });
});
