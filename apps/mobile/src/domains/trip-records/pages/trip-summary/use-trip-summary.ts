import { useEffect, useState } from "react";

import { getItinerary, type Itinerary } from "@/domains/itineraries";
import { getTrip, type Trip } from "@/domains/trips";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getSession } from "@/shared/auth/session";
import { listPhotos, type TripPhoto } from "../../api/photos.api";

export function useTripSummary(tripId: string) {
  const [trip, setTrip] = useState<Trip>();
  const [itinerary, setItinerary] = useState<Itinerary>();
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [accessToken, setAccessToken] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void Promise.all([getTrip(tripId), getItinerary(tripId), getSession()])
      .then(async ([nextTrip, nextItinerary, session]) => {
        setTrip(nextTrip);
        setItinerary(nextItinerary);
        setAccessToken(session?.accessToken);
        setPhotos(await listPhotos(tripId).catch(() => []));
      })
      .catch((caught) => setError(apiErrorMessage(caught)));
  }, [tripId]);
  return { accessToken, error, itinerary, photos, trip };
}
