import { useEffect, useState } from "react";

import { getItinerary, type Itinerary } from "@/domains/itineraries";
import { getTrip, type Trip } from "@/domains/trips";
import { apiErrorMessage } from "@/shared/api/trip-us-api";

export function useTripSummary(tripId: string) {
  const [trip, setTrip] = useState<Trip>();
  const [itinerary, setItinerary] = useState<Itinerary>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void Promise.all([getTrip(tripId), getItinerary(tripId)])
      .then(([nextTrip, nextItinerary]) => { setTrip(nextTrip); setItinerary(nextItinerary); })
      .catch((caught) => setError(apiErrorMessage(caught)));
  }, [tripId]);
  return { error, itinerary, trip };
}
