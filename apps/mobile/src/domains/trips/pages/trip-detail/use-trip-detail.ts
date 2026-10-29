import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getTrip, type Trip } from "@/domains/trips/api/trips.api";
import { getItinerary } from "@/domains/itineraries";
import { listPlaces } from "@/domains/places/api/places.api";

export function useTripDetail(tripId: string) {
  const [trip, setTrip] = useState<Trip>();
  const [placeCount, setPlaceCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    setError(undefined);
    try {
      const [nextTrip, places, itinerary] = await Promise.all([getTrip(tripId), listPlaces(tripId), getItinerary(tripId)]);
      setTrip(nextTrip);
      setPlaceCount(places.length);
      setScheduledCount(itinerary.items.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "여행을 불러오지 못했어요.");
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  return { trip, error, placeCount, reload, scheduledCount };
}
