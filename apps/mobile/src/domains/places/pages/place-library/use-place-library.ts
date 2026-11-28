import { useCallback, useMemo, useState } from "react";
import { useApiQuery } from "@/shared/query/use-resource";

import { deletePlaces, filterTravelPlaces, listPlaces, updatePlace, type SavedPlace } from "@/domains/places/api/places.api";
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

export type PlaceTag = SavedPlace["tag"];
type Feedback = { message: string; tone: "success" | "danger" };

export async function updatePlaceTags(tripId: string, placeIds: string[], tag: PlaceTag): Promise<void> {
  // Each update writes the complete list snapshot to the offline cache. Keep those
  // writes ordered so a slower response cannot restore an intermediate snapshot.
  for (const placeId of placeIds) await updatePlace(tripId, placeId, { tag });
}

export function usePlaceLibrary(tripId: string) {
  const query = useApiQuery(`trips:${tripId}:places`, listPlaces, tripId);
  const places = useMemo(() => filterTravelPlaces(query.data ?? []), [query.data]);
  const loading = query.loading;
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
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
    setSaving(true); setFeedback(undefined);
    try {
      await deletePlaces(tripId, placeIds);

      setSelectedIds(new Set());
      setFeedback({ message: `${placeIds.length}개의 장소를 삭제했어요.`, tone: "success" });
      return true;
    } catch (caught) {
      setFeedback({ message: safeErrorMessage(caught, "장소를 삭제하지 못했어요."), tone: "danger" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [tripId]);

  const updatePlacesTag = useCallback(async (placeIds: string[], tag: PlaceTag) => {
    if (placeIds.length === 0) return false;
    setSaving(true); setFeedback(undefined);
    try {
      await updatePlaceTags(tripId, placeIds, tag);
      setSelectedIds(new Set());
      setFeedback({ message: `${placeIds.length}개 장소의 태그를 변경했어요.`, tone: "success" });
      return true;
    } catch (caught) {
      setFeedback({ message: safeErrorMessage(caught, "장소 태그를 변경하지 못했어요."), tone: "danger" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [tripId]);

  return {
    clearSelection,
    places,
    loading,
    message: feedback?.message ?? (query.error ? safeErrorMessage(query.error, "장소를 불러오지 못했어요.") : undefined),
    messageTone: feedback?.tone ?? (query.error ? "danger" : undefined),
    reload,
    removePlaces,
    saving,
    selectPlaces,
    selectedIds,
    toggleSelection,
    updatePlacesTag,
  };
}
