import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi, tripUsApiBaseUrl } from "@/shared/api/trip-us-api";
import { clearSession, getSession, saveSession, type AuthSession } from "@/shared/auth/session";

export async function developmentLogin(): Promise<AuthSession> {
  const { data, error } = await tripUsApi.POST("/v1/auth/development");
  if (error) throw new Error(apiErrorMessage(error));
  await saveSession(data);
  return data;
}

export async function socialLogin(
  provider: components["schemas"]["SocialAuthProvider"],
  idToken: string,
  displayName?: string,
): Promise<AuthSession> {
  const { data, error } = await tripUsApi.POST("/v1/auth/social", { body: { provider, idToken, displayName } });
  if (error) {
    if (__DEV__) console.error("[SocialLoginApi]", { baseUrl: tripUsApiBaseUrl, error, provider });
    throw new Error(apiErrorMessage(error));
  }
  await saveSession(data);
  return data;
}

export async function logout(): Promise<void> {
  const session = await getSession();
  try {
    if (session) await tripUsApi.POST("/v1/auth/logout", { body: { refreshToken: session.refreshToken } });
  } finally {
    await clearSession();
  }
}
