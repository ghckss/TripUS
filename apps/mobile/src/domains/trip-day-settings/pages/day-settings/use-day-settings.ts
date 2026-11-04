import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { listPlaces, type SavedPlace } from "@/domains/places/api/places.api";
import { getTripDaySettings, replaceTripDaySettings, type TripDaySetting, type TripDaySettingInput } from "../../api/trip-day-settings.api";

export function useDaySettings(tripId: string) {
  const [settings, setSettings] = useState<TripDaySetting[]>([]);
  const [lodgings, setLodgings] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  const reload = useCallback(async () => {
    setLoading(true); setMessage(undefined);
    try {
      const [nextSettings, places] = await Promise.all([getTripDaySettings(tripId), listPlaces(tripId)]);
      setSettings(nextSettings);
      setLodgings(places.filter((place) => place.tag === "lodging"));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "날짜 설정을 불러오지 못했어요.");
    } finally { setLoading(false); }
  }, [tripId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const update = useCallback((date: string, changes: Partial<TripDaySettingInput>) => {
    setSettings((current) => current.map((setting) => setting.date === date ? { ...setting, ...changes } : setting));
  }, []);

  const save = useCallback(async () => {
    setSaving(true); setMessage(undefined);
    try {
      const input = settings.map(({ date, startTime, endTime, startPlaceId, endPlaceId }) => ({ date, startTime, endTime, startPlaceId, endPlaceId }));
      setSettings(await replaceTripDaySettings(tripId, input));
      setMessage("날짜별 출발·종료 설정을 저장했어요.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "날짜 설정을 저장하지 못했어요.");
    } finally { setSaving(false); }
  }, [settings, tripId]);

  return { loading, lodgings, message, reload, save, saving, settings, update };
}
