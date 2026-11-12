import { act, renderHook } from "@testing-library/react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { router } from "expo-router";

import { socialLogin } from "../../api/auth.api";
import { useLogin } from "./use-login";

const mockPromptAsync = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: (...args: unknown[]) => mockPromptAsync(...args),
  },
  isErrorWithCode: jest.fn(() => false),
  statusCodes: { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED" },
}));
jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { EMAIL: "email", FULL_NAME: "full-name" },
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));
jest.mock("../../api/auth.api", () => ({
  developmentLogin: jest.fn(),
  socialLogin: jest.fn(),
}));

describe("useLogin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "google-ios-client";
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = "google-android-client";
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "google-web-client";
  });

  it("keeps the login screen open without an error when Google login is cancelled", async () => {
    mockPromptAsync.mockResolvedValue({ type: "cancelled", data: null });
    const { result } = await renderHook(() => useLogin());

    await act(async () => {
      await result.current.loginWithGoogle();
    });

    expect(result.current.error).toBeUndefined();
    expect(socialLogin).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("uses the native Google result to create the TripUS session", async () => {
    mockPromptAsync.mockResolvedValue({
      type: "success",
      data: {
        idToken: "google-id-token",
        serverAuthCode: null,
        scopes: ["email", "profile"],
        user: { id: "google-user", email: "traveler@example.com", name: "여행자" },
      },
    });
    const { result } = await renderHook(() => useLogin());

    await act(async () => {
      await result.current.loginWithGoogle();
    });

    expect(GoogleSignin.configure).toHaveBeenCalledWith(expect.objectContaining({
      webClientId: "google-web-client",
      offlineAccess: false,
    }));
    expect(socialLogin).toHaveBeenCalledWith("google", "google-id-token", "여행자");
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/trips");
  });
});
