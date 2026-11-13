import { render } from "@testing-library/react-native";

import ProfileScreen from "./profile-page";

const mockUseProfile = jest.fn();

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock("./use-profile", () => ({ useProfile: () => mockUseProfile() }));
jest.mock("@/domains/auth/api/auth.api", () => ({ logout: jest.fn() }));

describe("ProfileScreen", () => {
  it("does not flash the Free plan before entitlements load", async () => {
    mockUseProfile.mockReturnValue({ entitlements: undefined, loading: true, user: undefined });

    const screen = await render(<ProfileScreen />);

    expect(screen.getByText("플랜 확인 중…")).toBeTruthy();
    expect(screen.queryByText("Free 플랜")).toBeNull();
  });

  it("shows the resolved plan after loading", async () => {
    mockUseProfile.mockReturnValue({
      entitlements: { tier: "plus", tripCount: 2, tripLimit: null, aiGenerationsUsed: 3, aiGenerationLimit: null },
      loading: false,
      user: undefined,
    });

    const screen = await render(<ProfileScreen />);

    expect(screen.getByText("Plus 플랜")).toBeTruthy();
  });
});
