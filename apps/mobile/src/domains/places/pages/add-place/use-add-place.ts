import { useCallback, useEffect, useRef, useState } from "react";

import { savePlace, searchPlaces, type PlaceSearchBounds, type PlaceSearchCandidate } from "@/domains/places/api/places.api";
import { getTrip } from "@/domains/trips/api/trips.api";
import type { LatLng } from "react-native-maps";
import { inferPlaceTag } from "@/domains/places/model/infer-place-tag";
import { safeErrorMessage } from "@/shared/api/trip-us-api";
import { useAppDialog } from "@/shared/ui/app-dialog";

export function useAddPlace(tripId: string, initialQuery = "") {
  const { showDialog } = useAppDialog();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PlaceSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string>();
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string>();
  const [bounds, setBounds] = useState<PlaceSearchBounds>();
  const [origin, setOrigin] = useState<LatLng | null>();
  const [selectedId, setSelectedId] = useState<string>();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const requestId = useRef(0);
  useEffect(() => {
    let active = true;
    void getTrip(tripId).then((trip) => {
      const point = [...trip.regions, trip.startPoint, trip.endPoint].find((point) => point?.latitude != null && point.longitude != null);
      if (active) setOrigin(point ? { latitude: point.latitude!, longitude: point.longitude! } : null);
    }).catch(() => { if (active) setOrigin(null); });
    return () => { active = false; requestId.current += 1; };
  }, [tripId]);
  const searchedInitialQuery = useRef(false);

  const search = useCallback(async () => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setMessage("두 글자 이상 입력해 주세요.");
      return;
    }
    const currentRequest = ++requestId.current;
    setSearching(true);
    setMessage(undefined);
    try {
      const candidates = await searchPlaces(tripId, normalized, bounds);
      if (currentRequest !== requestId.current) return;
      setResults(candidates);
      setSelectedId(candidates[0]?.googlePlaceId);
      if (candidates.length === 0) setMessage("검색 결과가 없어요. 지도를 옮기거나 다른 검색어를 입력해 보세요.");
    } catch (caught) {
      if (currentRequest === requestId.current) setMessage(safeErrorMessage(caught, "장소를 검색하지 못했어요."));
    } finally {
      if (currentRequest === requestId.current) setSearching(false);
    }
  }, [bounds, query, tripId]);

  const add = useCallback(async (candidate: PlaceSearchCandidate) => {
    setSavingId(candidate.googlePlaceId);
    setMessage(undefined);
    try {
      const result = await savePlace(tripId, {
        googlePlaceId: candidate.googlePlaceId,
        name: candidate.name,
        address: candidate.address ?? undefined,
        ...(candidate.latitude != null && candidate.longitude != null
          ? { latitude: candidate.latitude, longitude: candidate.longitude }
          : {}),
        ...(notes[candidate.googlePlaceId]?.trim() ? { note: notes[candidate.googlePlaceId].trim() } : {}),
        tag: inferPlaceTag(candidate.primaryType ?? null),
        preference: "want_to_visit",
        isPrimaryLodging: false,
      });
      setSavedIds((current) => new Set(current).add(candidate.googlePlaceId));
      setQuery("");
      setResults([]);
      setSelectedId(undefined);
      // Saving clears the search results, so drafts for other candidates are no longer
      // visible or actionable. Clear them together to avoid a hidden dirty state.
      setNotes({});
      showDialog({
        title: result.status === "created" ? "장소 추가 완료" : "이미 추가된 장소",
        message: result.status === "created" ? `${candidate.name}을(를) 추가했어요.` : "이미 추가한 장소예요.",
      });
    } catch (caught) {
      setMessage(safeErrorMessage(caught, "장소를 추가하지 못했어요."));
    } finally {
      setSavingId(undefined);
    }
  }, [notes, showDialog, tripId]);

  useEffect(() => {
    if (!initialQuery || searchedInitialQuery.current) return;
    searchedInitialQuery.current = true;
    void search();
  }, [initialQuery, search]);

  const selected = results.find((candidate) => candidate.googlePlaceId === selectedId);
  const note = selectedId ? notes[selectedId] ?? "" : "";
  const setNote = (value: string) => { if (selectedId) setNotes((current) => ({ ...current, [selectedId]: value })); };

  return { hasUnsavedNotes: Object.values(notes).some((value) => value.trim().length > 0), origin, bounds, setBounds, selected, setSelectedId, note, setNote, add, message, query, results, savedIds, savingId, search, searching, setQuery };
}
