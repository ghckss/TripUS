import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { deleteAccount } from "@/domains/auth/api/auth.api";
import { AppDialogProvider } from "@/shared/ui/app-dialog";
import ProfileScreen from "./profile-page";

const mockUseProfile = jest.fn();

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock("./use-profile", () => ({ useProfile: () => mockUseProfile() }));
jest.mock("@/domains/auth/api/auth.api", () => ({ deleteAccount: jest.fn(), logout: jest.fn() }));

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

  it("deletes the account only after the irreversible action is confirmed", async () => {
    mockUseProfile.mockReturnValue({ entitlements: undefined, loading: false, user: { displayName: "여행자" } });
    jest.mocked(deleteAccount).mockResolvedValue();
    const screen = await render(<AppDialogProvider><ProfileScreen /></AppDialogProvider>);

    await fireEvent.press(screen.getByRole("button", { name: "계정 탈퇴" }));
    expect(screen.getByText("모든 여행, 일정, 사진과 기록이 영구 삭제되며 복구할 수 없어요.")).toBeOnTheScreen();
    expect(deleteAccount).not.toHaveBeenCalled();

    await fireEvent.press(screen.getAllByRole("button", { name: "계정 탈퇴" })[1]);
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });
});
