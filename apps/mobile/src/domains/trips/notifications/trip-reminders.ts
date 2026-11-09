import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const reminderKey = (tripId: string) => `tripus.trip.${tripId}.reminders`;

async function readScheduledIds(tripId: string): Promise<string[]> {
  const stored = await SecureStore.getItemAsync(reminderKey(tripId));
  return stored ? JSON.parse(stored) as string[] : [];
}

export async function clearTripReminders(tripId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const ids = await readScheduledIds(tripId);
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await SecureStore.deleteItemAsync(reminderKey(tripId));
}
