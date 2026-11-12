import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { listTrips, type Trip } from "@/domains/trips/api/trips.api";
import { safeErrorMessage } from "@/shared/api/trip-us-api";

export function useExternalPlaceSave() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setTrips(await listTrips());
    } catch (caught) {
      setError(safeErrorMessage(caught, "여행을 불러오지 못했어요."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return { error, loading, reload, trips };
}
