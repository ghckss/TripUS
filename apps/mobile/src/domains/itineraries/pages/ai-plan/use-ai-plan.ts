import { useState } from "react";
import { useApiQuery } from "@/shared/query/use-resource";

import { generateAiPlan, getLatestAiPlanRequest, type AiPlanRequest } from "../../api/itineraries.api";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getEntitlements } from "@/domains/entitlements/api/entitlements.api";
import { getTrip } from "@/domains/trips";

export function useAiPlan(tripId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const { data: entitlements } = useApiQuery("entitlements", getEntitlements);
  const { data: trip } = useApiQuery(`trips:${tripId}`, getTrip, tripId);
  const { data: latestRequest } = useApiQuery(`trips:${tripId}:ai-request`, getLatestAiPlanRequest, tripId);
  const generate = async (request: AiPlanRequest) => {
    setLoading(true);
    setError(undefined);
    try {
      await generateAiPlan(tripId, request);
      return true;
    } catch (caught) {
      setError(apiErrorMessage(caught));
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { entitlements, error, generate, latestRequest, loading, missingRegions: trip !== undefined && (trip.regions?.length ?? 0) === 0 };
}
