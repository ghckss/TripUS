import { useEffect, useState } from "react";
import { getItinerary } from "@/domains/itineraries";
import { getTrip } from "@/domains/trips";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getSession } from "@/shared/auth/session";
import { useApiQuery } from "@/shared/query/use-resource";
import { listPhotos } from "../api/photos.api";

export function useRecordResources(tripId: string) {
  const trip = useApiQuery(`trips:${tripId}`, getTrip, tripId);
  const itinerary = useApiQuery(`trips:${tripId}:itinerary`, getItinerary, tripId);
  const photos = useApiQuery(`trips:${tripId}:photos`, listPhotos, tripId);
  const [accessToken, setAccessToken] = useState<string>();
  useEffect(() => { let current = true; void getSession().then((session) => { if (current) setAccessToken(session?.accessToken); }); return () => { current = false; }; }, []);
  const error = trip.error ?? itinerary.error ?? photos.error;
  return { trip: trip.data, itinerary: itinerary.data, photos: photos.data ?? [], accessToken,
    loading: trip.loading || itinerary.loading || photos.loading,
    error: error ? apiErrorMessage(error) : undefined,
    reload: () => Promise.all([trip.refetch(), itinerary.refetch(), photos.refetch()]) };
}
