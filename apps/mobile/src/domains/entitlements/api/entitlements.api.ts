import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";

export type Entitlements = components["schemas"]["EntitlementsResponseDto"];

export async function getEntitlements(): Promise<Entitlements> {
  const { data, error } = await tripUsApi.GET("/v1/me/entitlements");
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}
