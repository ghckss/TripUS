import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getTrip } from "@/domains/trips";
import { getItinerary, replaceItinerary, type Itinerary } from "../../api/itineraries.api";

export function useItineraryEdit(tripId: string) {
  const [itinerary, setItinerary] = useState<Itinerary>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState<string>();

  const reload = useCallback(async () => {
    setError(undefined);
    try {
      const [nextItinerary, trip] = await Promise.all([getItinerary(tripId), getTrip(tripId)]);
      setItinerary(nextItinerary);
      setStartDate(trip.startDate);
    } catch (caught) { setError(apiErrorMessage(caught)); }
  }, [tripId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const addUnplaced = (savedPlaceId: string) => {
    if (!itinerary) return;
    const firstDate = itinerary.items[0]?.date ?? startDate;
    if (!firstDate) return;
    setItinerary({
      items: [...itinerary.items, {
        id: `local:${savedPlaceId}`, savedPlaceId, placeName: itinerary.unplaced.find((place) => place.savedPlaceId === savedPlaceId)?.placeName ?? "장소",
        address: null, date: firstDate, position: itinerary.items.filter((item) => item.date === firstDate).length,
        locked: false, source: "manual", visitStatus: null, rating: null, review: null,
      }],
      unplaced: itinerary.unplaced.filter((place) => place.savedPlaceId !== savedPlaceId),
    });
  };

  const save = async () => {
    if (!itinerary) return false;
    setSaving(true); setError(undefined);
    try {
      setItinerary(await replaceItinerary(tripId, itinerary.items.map((item) => ({
        savedPlaceId: item.savedPlaceId, date: item.date!, position: item.position!, locked: item.locked,
      }))));
      return true;
    } catch (caught) { setError(apiErrorMessage(caught)); return false; } finally { setSaving(false); }
  };

  return { addUnplaced, error, itinerary, reload, save, saving };
}
