import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getTrip, type Trip } from "@/domains/trips/api/trips.api";
import { getItinerary } from "@/domains/itineraries";
import { listPlaces } from "@/domains/places/api/places.api";
import { replaceTripReminders } from "@/domains/trips/notifications/trip-reminders";

export function useTripDetail(tripId: string) {
  const [trip, setTrip] = useState<Trip>();
  const [placeCount, setPlaceCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [error, setError] = useState<string>();
  const [reminderMessage, setReminderMessage] = useState<string>();
  const [settingReminder, setSettingReminder] = useState(false);

  const reload = useCallback(async () => {
    setError(undefined);
    try {
      const [nextTrip, places, itinerary] = await Promise.all([getTrip(tripId), listPlaces(tripId), getItinerary(tripId)]);
      setTrip(nextTrip);
      setPlaceCount(places.length);
      setScheduledCount(itinerary.items.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "여행을 불러오지 못했어요.");
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  const enableReminders = useCallback(async () => {
    if (!trip) return;
    setSettingReminder(true);
    setReminderMessage(undefined);
    try {
      const count = await replaceTripReminders(trip);
      setReminderMessage(count > 0 ? `여행 알림 ${count}개를 설정했어요.` : "앞으로 설정할 여행 알림이 없어요.");
    } catch (caught) {
      setReminderMessage(caught instanceof Error ? caught.message : "여행 알림을 설정하지 못했어요.");
    } finally {
      setSettingReminder(false);
    }
  }, [trip]);

  return { enableReminders, trip, error, placeCount, reload, reminderMessage, scheduledCount, settingReminder };
}
