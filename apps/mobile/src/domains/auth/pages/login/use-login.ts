import { useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { AuthRequest, exchangeCodeAsync, makeRedirectUri, ResponseType } from "expo-auth-session";
import { router } from "expo-router";
import { Platform } from "react-native";

import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { developmentLogin, socialLogin } from "../../api/auth.api";

const googleDiscovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const LOGIN_CANCELLED = Symbol("LOGIN_CANCELLED");

export function useLogin() {
  const [loading, setLoading] = useState<"development" | "google" | "apple">();
  const [error, setError] = useState<string>();
  const googleClientId = Platform.select({
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  const finish = () => router.replace("/(tabs)/trips");
  const run = async (kind: typeof loading, action: () => Promise<unknown>) => {
    setLoading(kind); setError(undefined);
    try {
      const result = await action();
      if (result !== LOGIN_CANCELLED) finish();
    }
    catch (caught) { setError(apiErrorMessage(caught)); }
    finally { setLoading(undefined); }
  };

  const loginForDevelopment = () => run("development", developmentLogin);

  const loginWithGoogle = () => run("google", async () => {
    if (!googleClientId) throw new Error("Google OAuth 클라이언트 ID가 설정되지 않았어요.");
    const redirectUri = makeRedirectUri({ scheme: "tripus", path: "auth/google" });
    const request = new AuthRequest({
      clientId: googleClientId,
      redirectUri,
      responseType: ResponseType.Code,
      scopes: ["openid", "profile", "email"],
      usePKCE: true,
    });
    const result = await request.promptAsync(googleDiscovery);
    if (result.type === "cancel" || result.type === "dismiss") return LOGIN_CANCELLED;
    if (result.type !== "success" || !result.params.code) throw new Error("Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.");
    const tokens = await exchangeCodeAsync({
      clientId: googleClientId,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    }, googleDiscovery);
    if (!tokens.idToken) throw new Error("Google ID 토큰을 받지 못했어요.");
    await socialLogin("google", tokens.idToken);
  });

  const loginWithApple = () => run("apple", async () => {
    if (Platform.OS !== "ios" || !await AppleAuthentication.isAvailableAsync()) {
      throw new Error("이 기기에서는 Apple 로그인을 사용할 수 없어요.");
    }
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error("Apple ID 토큰을 받지 못했어요.");
    const displayName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ") || undefined;
    await socialLogin("apple", credential.identityToken, displayName);
  });

  return { error, googleConfigured: Boolean(googleClientId), loading, loginForDevelopment, loginWithApple, loginWithGoogle };
}
