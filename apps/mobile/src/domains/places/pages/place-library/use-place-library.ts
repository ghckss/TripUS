import { useCallback, useMemo, useState } from "react";
import { useApiQuery } from "@/shared/query/use-resource";

import { deletePlaces, filterTravelPlaces, listPlaces, type SavedPlace } from "@/domains/places/api/places.api";
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
  const query = useApiQuery(`trips:${tripId}:places`, listPlaces, tripId);
  const places = useMemo(() => filterTravelPlaces(query.data ?? []), [query.data]);
  const loading = query.loading;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [selection, setSelectedIds] = useState<Set<string>>(() => new Set());

  const reload = query.refetch;
  const selectedIds = useMemo(() => {
    const available = new Set(places.map((place) => place.id));
    return new Set([...selection].filter((id) => available.has(id)));
  }, [places, selection]);

  const toggleSelection = useCallback((placeId: string) => {
    setSelectedIds((current) => togglePlaceSelection(current, placeId));
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectPlaces = useCallback((placeIds: string[]) => setSelectedIds(new Set(placeIds)), []);

  const removePlaces = useCallback(async (placeIds: string[]) => {
    if (placeIds.length === 0) return false;
    setSaving(true); setMessage(undefined);
    try {
      await deletePlaces(tripId, placeIds);

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

  return {
    clearSelection,
    places,
    loading,
    message: message ?? (query.error ? safeErrorMessage(query.error, "장소를 불러오지 못했어요.") : undefined),
    reload,
    removePlaces,
    saving,
    selectPlaces,
    selectedIds,
    toggleSelection,
  };
}
