import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import {
  getTripDaySettings,
  replaceTripDaySettings,
  type TripDaySetting,
  type TripDaySettingInput,
} from "@/domains/trip-day-settings/api/trip-day-settings.api";

export function useItineraryDaySettings(tripId: string) {
  const [settings, setSettings] = useState<TripDaySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage(undefined);
    try {
      const nextSettings = await getTripDaySettings(tripId);
      setSettings(nextSettings);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "날짜별 활동 시간을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const update = useCallback((date: string, changes: Partial<TripDaySettingInput>) => {
    setSettings((current) => current.map((setting) =>
      setting.date === date ? { ...setting, ...changes } : setting));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(undefined);
    try {
      const input = settings.map(({ date, startTime, endTime, planBPlaceName, planBAddress, planBReason }) => ({
        date,
        startTime,
        endTime,
        planBPlaceName,
        planBAddress,
        planBReason,
      }));
      setSettings(await replaceTripDaySettings(tripId, input));
      setMessage("날짜별 활동 시간을 저장했어요.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "날짜별 활동 시간을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }, [settings, tripId]);

  return { loading, message, reload, save, saving, settings, update };
}
