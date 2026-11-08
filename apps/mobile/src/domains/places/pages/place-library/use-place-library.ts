import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { deletePlace, listPlaces, updatePlace, type SavedPlace, type UpdateSavedPlaceInput } from "@/domains/places/api/places.api";

export function usePlaceLibrary(tripId: string) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPlaces(await listPlaces(tripId));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "장소를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  const editPlace = useCallback(async (placeId: string, input: UpdateSavedPlaceInput) => {
    setSaving(true); setMessage(undefined);
    try { await updatePlace(tripId, placeId, input); setMessage("장소 정보를 변경했어요."); await reload(); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "장소를 변경하지 못했어요."); }
    finally { setSaving(false); }
  }, [reload, tripId]);

  const removePlace = useCallback(async (placeId: string) => {
    setSaving(true); setMessage(undefined);
    try { await deletePlace(tripId, placeId); setMessage("장소를 삭제했어요."); await reload(); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "장소를 삭제하지 못했어요."); }
    finally { setSaving(false); }
  }, [reload, tripId]);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  return { editPlace, places, loading, message, reload, removePlace, saving };
}
