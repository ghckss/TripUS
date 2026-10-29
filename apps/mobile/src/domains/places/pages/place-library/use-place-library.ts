import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { listPlaces, savePlace, type SavedPlace } from "@/domains/places/api/places.api";

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

  const addMockPlace = useCallback(async () => {
    setSaving(true);
    try {
      const result = await savePlace(tripId, {
        googlePlaceId: "mock-seongsu-cafe",
        name: "성수의 작은 카페",
        tag: "cafe",
        preference: "want_to_visit",
        note: "목업 검색 결과에서 저장",
      });
      setMessage(result.status === "created" ? "장소를 저장했어요." : "이미 저장한 장소예요.");
      await reload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "장소를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }, [reload, tripId]);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  return { places, loading, saving, message, reload, addMockPlace };
}
