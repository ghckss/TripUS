import { useCallback, useEffect, useRef, useState } from "react";

import { savePlace, searchPlaces, type PlaceSearchCandidate } from "@/domains/places/api/places.api";

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

export function useAddPlace(tripId: string, initialQuery = "") {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PlaceSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string>();
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string>();
  const searchedInitialQuery = useRef(false);

  const search = useCallback(async () => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setMessage("두 글자 이상 입력해 주세요.");
      return;
    }
    setSearching(true);
    setMessage(undefined);
    try {
      const candidates = await searchPlaces(tripId, normalized);
      setResults(candidates);
      if (candidates.length === 0) setMessage("검색 결과가 없어요. 다른 검색어를 입력해 보세요.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "장소를 검색하지 못했어요.");
    } finally {
      setSearching(false);
    }
  }, [query, tripId]);

  const add = useCallback(async (candidate: PlaceSearchCandidate) => {
    setSavingId(candidate.googlePlaceId);
    setMessage(undefined);
    try {
      const result = await savePlace(tripId, {
        googlePlaceId: candidate.googlePlaceId,
        name: candidate.name,
        address: candidate.address ?? undefined,
        tag: inferTag(candidate.primaryType ?? null),
        preference: "want_to_visit",
      });
      setSavedIds((current) => new Set(current).add(candidate.googlePlaceId));
      setMessage(result.status === "created" ? `${candidate.name}을(를) 추가했어요.` : "이미 추가한 장소예요.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "장소를 추가하지 못했어요.");
    } finally {
      setSavingId(undefined);
    }
  }, [tripId]);

  useEffect(() => {
    if (!initialQuery || searchedInitialQuery.current) return;
    searchedInitialQuery.current = true;
    void search();
  }, [initialQuery, search]);

  return { add, message, query, results, savedIds, savingId, search, searching, setQuery };
}
