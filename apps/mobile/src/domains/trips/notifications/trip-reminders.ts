import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { Trip } from "@/domains/trips/api/trips.api";

const reminderKey = (tripId: string) => `tripus.trip.${tripId}.reminders`;

function localDate(date: string, hour: number): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

async function readScheduledIds(tripId: string): Promise<string[]> {
  const stored = await SecureStore.getItemAsync(reminderKey(tripId));
  return stored ? JSON.parse(stored) as string[] : [];
}

export async function replaceTripReminders(trip: Trip): Promise<number> {
  if (Platform.OS === "web") throw new Error("여행 알림은 iOS와 Android 앱에서 설정할 수 있어요.");

  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error("기기 설정에서 TripUS 알림 권한을 허용해 주세요.");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("trip-reminders", {
      name: "여행 알림",
      importance: AndroidImportance.DEFAULT,
    });
  }

  const previousIds = await readScheduledIds(trip.id);
  await Promise.all(previousIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  const now = Date.now();
  const reminders = [
    {
      date: localDate(trip.startDate, 9),
      title: `${trip.title} 출발일이에요`,
      body: "TripUS에서 오늘 일정을 확인해 보세요.",
    },
    {
      date: localDate(trip.endDate, 19),
      title: `${trip.title}을 정리해 볼까요?`,
      body: "방문한 장소에 별점을 남기고 여행을 기록해 보세요.",
    },
  ].filter((reminder) => reminder.date.getTime() > now);

  const ids = await Promise.all(reminders.map((reminder) => Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title,
      body: reminder.body,
      data: { tripId: trip.id, path: `/trips/${trip.id}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminder.date,
      ...(Platform.OS === "android" ? { channelId: "trip-reminders" } : {}),
    },
  })));

  await SecureStore.setItemAsync(reminderKey(trip.id), JSON.stringify(ids));
  return ids.length;
}

export async function clearTripReminders(tripId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const ids = await readScheduledIds(tripId);
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await SecureStore.deleteItemAsync(reminderKey(tripId));
}
