import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getItinerary, type Itinerary } from "@/domains/itineraries/api/itineraries.api";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { completeTrip, type CompleteTripItem } from "../../api/trip-records.api";

export function useCompleteTrip(tripId: string) {
  const [itinerary, setItinerary] = useState<Itinerary>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const reload = useCallback(async () => {
    setError(undefined);
    try { setItinerary(await getItinerary(tripId)); } catch (caught) { setError(apiErrorMessage(caught)); }
  }, [tripId]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const complete = async (items: CompleteTripItem[]) => {
    setSaving(true); setError(undefined);
    try { await completeTrip(tripId, items); return true; }
    catch (caught) { setError(apiErrorMessage(caught)); return false; }
    finally { setSaving(false); }
  };
  return { complete, error, itinerary, reload, saving };
}
