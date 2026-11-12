import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { deletePlaces, listTravelPlaces, updatePlace, type SavedPlace, type UpdateSavedPlaceInput } from "@/domains/places/api/places.api";
import { safeErrorMessage } from "@/shared/api/trip-us-api";

export function togglePlaceSelection(current: Set<string>, placeId: string): Set<string> {
  const next = new Set(current);
  if (next.has(placeId)) next.delete(placeId);
  else next.add(placeId);
  return next;
}

export function allPlaceIds(places: Pick<SavedPlace, "id">[]): Set<string> {
  return new Set(places.map((place) => place.id));
}

export function usePlaceLibrary(tripId: string) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const nextPlaces = await listTravelPlaces(tripId);
      setPlaces(nextPlaces);
      const availableIds = new Set(nextPlaces.map((place) => place.id));
      setSelectedIds((current) => new Set([...current].filter((id) => availableIds.has(id))));
    } catch (caught) {
      setMessage(safeErrorMessage(caught, "장소를 불러오지 못했어요."));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  const editPlace = useCallback(async (placeId: string, input: UpdateSavedPlaceInput) => {
    setSaving(true); setMessage(undefined);
    try { await updatePlace(tripId, placeId, input); setMessage("장소 정보를 변경했어요."); await reload(); }
    catch (caught) { setMessage(safeErrorMessage(caught, "장소를 변경하지 못했어요.")); }
    finally { setSaving(false); }
  }, [reload, tripId]);

  const toggleSelection = useCallback((placeId: string) => {
    setSelectedIds((current) => togglePlaceSelection(current, placeId));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectAll = useCallback(() => setSelectedIds(allPlaceIds(places)), [places]);

  const removePlaces = useCallback(async (placeIds: string[]) => {
    if (placeIds.length === 0) return false;
    setSaving(true); setMessage(undefined);
    try {
      await deletePlaces(tripId, placeIds);
      const removed = new Set(placeIds);
      setPlaces((current) => current.filter((place) => !removed.has(place.id)));
      setSelectedIds(new Set());
      setMessage(`${placeIds.length}개의 장소를 삭제했어요.`);
      return true;
    } catch (caught) {
      setMessage(safeErrorMessage(caught, "장소를 삭제하지 못했어요."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  return {
    clearSelection,
    editPlace,
    places,
    loading,
    message,
    reload,
    removePlaces,
    saving,
    selectAll,
    selectedIds,
    toggleSelection,
  };
}
