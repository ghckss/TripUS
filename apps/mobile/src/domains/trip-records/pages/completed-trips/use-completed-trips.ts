import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import type { Trip } from "@/domains/trips";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { listCompletedTrips } from "../../api/trip-records.api";

export function useCompletedTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string>();
  const reload = useCallback(async () => {
    setError(undefined);
    try { setTrips(await listCompletedTrips()); } catch (caught) { setError(apiErrorMessage(caught)); }
  }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  return { error, reload, trips };
}
