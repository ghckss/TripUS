import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { deletePlace, listPlaces, savePlace, searchPlaces, updatePlace, type PlaceSearchCandidate, type SavedPlace, type UpdateSavedPlaceInput } from "@/domains/places/api/places.api";

function inferTag(primaryType: string | null): "attraction" | "food" | "cafe" | "shopping" | "lodging" | "transport" | "activity" | "other" {
  if (!primaryType) return "other";
  if (primaryType.includes("restaurant") || primaryType.includes("food")) return "food";
  if (primaryType.includes("cafe")) return "cafe";
  if (primaryType.includes("store") || primaryType.includes("shopping")) return "shopping";
  if (primaryType.includes("lodging") || primaryType.includes("hotel")) return "lodging";
  if (primaryType.includes("station") || primaryType.includes("airport")) return "transport";
  if (primaryType.includes("attraction") || primaryType.includes("museum")) return "attraction";
  if (primaryType.includes("park") || primaryType.includes("activity")) return "activity";
  return "other";
}

export function usePlaceLibrary(tripId: string) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);

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

  const search = useCallback(async () => {
    if (query.trim().length < 2) {
      setMessage("두 글자 이상 입력해 주세요.");
      return;
    }
    setSearching(true);
    setMessage(undefined);
    try { setResults(await searchPlaces(tripId, query.trim())); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "장소를 검색하지 못했어요."); }
    finally { setSearching(false); }
  }, [query, tripId]);

  const saveCandidate = useCallback(async (candidate: PlaceSearchCandidate) => {
    setSaving(true);
    try {
      const result = await savePlace(tripId, {
        googlePlaceId: candidate.googlePlaceId,
        name: candidate.name,
        address: candidate.address ?? undefined,
        tag: inferTag(candidate.primaryType ?? null),
        preference: "want_to_visit",
      });
      setMessage(result.status === "created" ? "장소를 저장했어요." : "이미 저장한 장소예요.");
      await reload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "장소를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }, [reload, tripId]);

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

  return { editPlace, places, loading, message, query, reload, removePlace, results, saveCandidate, saving, search, searching, setQuery };
}
