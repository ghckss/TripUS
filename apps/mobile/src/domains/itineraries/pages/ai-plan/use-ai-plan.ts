import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { generateAiPlan, getLatestAiPlanRequest, type AiPlanRequest } from "../../api/itineraries.api";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getEntitlements, type Entitlements } from "@/domains/entitlements/api/entitlements.api";
import { getTrip } from "@/domains/trips";

export function useAiPlan(tripId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [entitlements, setEntitlements] = useState<Entitlements>();
  const [hasRegions, setHasRegions] = useState<boolean>();
  const [latestRequest, setLatestRequest] = useState<AiPlanRequest | null>();
  useFocusEffect(useCallback(() => {
    void Promise.all([
      getEntitlements().then(setEntitlements),
      getTrip(tripId).then((trip) => setHasRegions((trip.regions?.length ?? 0) > 0)),
      getLatestAiPlanRequest(tripId).then(setLatestRequest),
    ]).catch(() => undefined);
  }, [tripId]));

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

  return { entitlements, error, generate, latestRequest, loading, missingRegions: hasRegions === false };
}
