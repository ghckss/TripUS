import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getItinerary, type Itinerary } from "@/domains/itineraries";
import { getTrip, type Trip } from "@/domains/trips";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getSession } from "@/shared/auth/session";
import { listPhotos, type TripPhoto } from "../../api/photos.api";

export function useTripRecap(tripId: string) {
  const [trip, setTrip] = useState<Trip>();
  const [itinerary, setItinerary] = useState<Itinerary>();
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [accessToken, setAccessToken] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextTrip, nextItinerary, nextPhotos, session] = await Promise.all([
        getTrip(tripId), getItinerary(tripId), listPhotos(tripId), getSession(),
      ]);
      setTrip(nextTrip);
      setItinerary(nextItinerary);
      setPhotos(nextPhotos);
      setAccessToken(session?.accessToken);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return { accessToken, error, itinerary, loading, photos, reload, trip };
}
