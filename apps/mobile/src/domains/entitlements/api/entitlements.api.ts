import { defineQuery, getAccountScope, setResource } from "@/shared/query/query-client";
import type { components } from "@tripus/api-client";

import { apiErrorMessage, tripUsApi } from "@/shared/api/trip-us-api";

export type Entitlements = components["schemas"]["EntitlementsResponseDto"];

export const getEntitlements = defineQuery(() => ({
  key: "entitlements", staleTime: 60000,
  request: async (): Promise<Entitlements> => {
    const { data, error } = await tripUsApi.GET("/v1/me/entitlements");
    if (error) throw new Error(apiErrorMessage(error));
    return data;
  },
}));

export async function upgradePlan(): Promise<Entitlements> {
  const account = getAccountScope();
  const { data, error } = await tripUsApi.POST('/v1/me/entitlements/upgrade');
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  setResource("entitlements", data);
  return data;
}
