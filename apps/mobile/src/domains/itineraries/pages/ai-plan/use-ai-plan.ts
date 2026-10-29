import { useState } from "react";

import { generateAiPlan, type TravelStyle } from "../../api/itineraries.api";
import { apiErrorMessage } from "@/shared/api/trip-us-api";

export function useAiPlan(tripId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

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

  return { error, generate, loading };
}
