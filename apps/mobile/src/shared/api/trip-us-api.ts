import { createTripUsApiClient } from "@tripus/api-client";
import Constants from "expo-constants";

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
export const tripUsApi = createTripUsApiClient({ baseUrl: tripUsApiBaseUrl });

export function apiErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
