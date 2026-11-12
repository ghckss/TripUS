import { useState } from "react";
import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { Platform } from "react-native";

import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { developmentLogin, socialLogin } from "../../api/auth.api";

const LOGIN_CANCELLED = Symbol("LOGIN_CANCELLED");

export function useLogin() {
  const [loading, setLoading] = useState<"development" | "google" | "apple">();
  const [error, setError] = useState<string>();
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googlePlatformClientId = Platform.select({
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
  const googleConfigured = Boolean(googleWebClientId && googlePlatformClientId);

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
    if (!googleConfigured || !googleWebClientId) throw new Error("Google OAuth 클라이언트 ID가 설정되지 않았어요.");
    GoogleSignin.configure({
      webClientId: googleWebClientId,
      iosClientId: Platform.OS === "ios" ? googlePlatformClientId : undefined,
      offlineAccess: false,
    });
    try {
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const result = await GoogleSignin.signIn();
      if (result.type === "cancelled") return LOGIN_CANCELLED;
      if (!result.data.idToken) throw new Error("Google ID 토큰을 받지 못했어요.");
      await socialLogin("google", result.data.idToken, result.data.user.name ?? undefined);
    } catch (caught) {
      if (isErrorWithCode(caught) && caught.code === statusCodes.SIGN_IN_CANCELLED) return LOGIN_CANCELLED;
      if (__DEV__) console.error("[GoogleSignIn]", caught);
      if (isErrorWithCode(caught) && caught.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error("Google Play 서비스를 사용할 수 없어요. 업데이트 후 다시 시도해 주세요.");
      }
      if (isErrorWithCode(caught) && caught.code === statusCodes.IN_PROGRESS) {
        throw new Error("Google 로그인이 이미 진행 중이에요.");
      }
      throw new Error("Google 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
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

  return { error, googleConfigured, loading, loginForDevelopment, loginWithApple, loginWithGoogle };
}
