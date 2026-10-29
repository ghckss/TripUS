import { createTripUsApiClient } from "@tripus/api-client";
import Constants from "expo-constants";
import { clearSession, getSession, saveSession, type AuthSession } from "@/shared/auth/session";

function resolveApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  const developmentHost = Constants.expoConfig?.hostUri;
  if (developmentHost) {
    return `http://${new URL(`http://${developmentHost}`).hostname}:3000`;
  }

  return "http://127.0.0.1:3000";
}

export const tripUsApiBaseUrl = resolveApiBaseUrl();
let refreshPromise: Promise<AuthSession | null> | undefined;

async function refreshAccessToken(): Promise<AuthSession | null> {
  const session = await getSession();
  if (!session) return null;
  const response = await fetch(`${tripUsApiBaseUrl}/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!response.ok) {
    await clearSession();
    return null;
  }
  const next = await response.json() as AuthSession;
  await saveSession(next);
  return next;
}

export const authenticatedFetch: typeof fetch = async (input, init) => {
  const session = await getSession();
  const headers = new Headers(init?.headers);
  if (session?.accessToken) headers.set("authorization", `Bearer ${session.accessToken}`);
  let response = await fetch(input, { ...init, headers });
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (response.status !== 401 || url.includes("/v1/auth/")) return response;
  refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = undefined; });
  const refreshed = await refreshPromise;
  if (!refreshed) return response;
  headers.set("authorization", `Bearer ${refreshed.accessToken}`);
  response = await fetch(input, { ...init, headers });
  return response;
};

export const tripUsApi = createTripUsApiClient({ baseUrl: tripUsApiBaseUrl, fetch: authenticatedFetch });

export function apiErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
