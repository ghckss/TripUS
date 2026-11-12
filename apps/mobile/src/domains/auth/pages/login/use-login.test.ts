import { act, renderHook } from "@testing-library/react-native";
import { router } from "expo-router";

import { socialLogin } from "../../api/auth.api";
import { useLogin } from "./use-login";

const mockPromptAsync = jest.fn();

jest.mock("expo-auth-session", () => ({
  AuthRequest: jest.fn().mockImplementation(() => ({
    codeVerifier: "code-verifier",
    promptAsync: mockPromptAsync,
  })),
  exchangeCodeAsync: jest.fn(),
  makeRedirectUri: jest.fn(() => "tripus://auth/google"),
  ResponseType: { Code: "code" },
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
    mockPromptAsync.mockResolvedValue({ type: "cancel", params: {} });
    const { result } = await renderHook(() => useLogin());

    await act(async () => {
      await result.current.loginWithGoogle();
    });

    expect(result.current.error).toBeUndefined();
    expect(socialLogin).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
