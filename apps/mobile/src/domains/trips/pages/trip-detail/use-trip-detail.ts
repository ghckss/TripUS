import { getTrip } from "@/domains/trips/api/trips.api";
import { getItinerary } from "@/domains/itineraries";
import { filterTravelPlaces, listPlaces } from "@/domains/places/api/places.api";
import { safeErrorMessage } from "@/shared/api/trip-us-api";
import { useApiQuery } from "@/shared/query/use-resource";

export function useTripDetail(tripId: string) {
  const trip = useApiQuery(`trips:${tripId}`, getTrip, tripId);
  const places = useApiQuery(`trips:${tripId}:places`, listPlaces, tripId);
  const itinerary = useApiQuery(`trips:${tripId}:itinerary`, getItinerary, tripId);
  const error = trip.error ?? places.error ?? itinerary.error;
  return { trip: trip.data, placeCount: filterTravelPlaces(places.data ?? []).length,
    scheduledCount: itinerary.data?.items.length ?? 0,
    error: error ? safeErrorMessage(error, "여행을 불러오지 못했어요.") : undefined,
    reload: () => Promise.all([trip.refetch(), places.refetch(), itinerary.refetch()]) };
}
