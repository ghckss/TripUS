import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getTrip, type Trip } from "@/domains/trips/api/trips.api";

export function useTripDetail(tripId: string) {
  const [trip, setTrip] = useState<Trip>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    setError(undefined);
    try {
      setTrip(await getTrip(tripId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "여행을 불러오지 못했어요.");
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  return { trip, error, reload };
}
