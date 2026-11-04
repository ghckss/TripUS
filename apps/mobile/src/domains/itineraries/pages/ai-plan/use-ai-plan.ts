import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { generateAiPlan, type TravelStyle } from "../../api/itineraries.api";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getEntitlements, type Entitlements } from "@/domains/entitlements/api/entitlements.api";

export function useAiPlan(tripId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [entitlements, setEntitlements] = useState<Entitlements>();
  useFocusEffect(useCallback(() => { void getEntitlements().then(setEntitlements).catch(() => undefined); }, []));

  const generate = async (style: TravelStyle) => {
    setLoading(true);
    setError(undefined);
    try {
      await generateAiPlan(tripId, style);
      return true;
    } catch (caught) {
      setError(apiErrorMessage(caught));
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { entitlements, error, generate, loading };
}
