import { RouteConnector } from "./route-connector";
import type { SavedPlace } from "@/domains/places/api/places.api";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import type { ItineraryActivity, ItineraryItem } from "../../api/itineraries.api";

type Entry = { id: string; time: string | null; duration: number | null; position: number; title: string; label: string; detail?: string | null; place: ItineraryItem; anchor: number };

/** Place order follows the current itinerary; route connectors fetch their own durations. */
export function mergeDayTimeline(items: ItineraryItem[], _activities: ItineraryActivity[], startId?: string, endId?: string): Entry[] {
  const places: Entry[] = items.map((item) => ({ id: item.id, time: item.scheduledTime ?? null, duration: item.durationMinutes ?? null,
    position: item.position ?? 0, title: item.placeName, label: item.id === startId ? "출발" : item.id === endId ? "도착" : "방문",
    detail: item.id === startId || item.id === endId ? null : item.activitySummary,
    place: item, anchor: item.id === startId ? -1 : item.id === endId ? 1 : 0 }));
  // User order is authoritative after DnD; neither old AI timestamps nor transport events can reorder it.
  return places.sort((a, b) => a.anchor - b.anchor || a.position - b.position);

}

/** Hotel activities from older plans must not insert additional intermediate hotel visits on the map. */
export function timelineMapItems(items: ItineraryItem[], _activities: ItineraryActivity[], _places: SavedPlace[], startId?: string, endId?: string): ItineraryItem[] {
  return mergeDayTimeline(items, [], startId, endId).map((entry) => entry.place);
}

export function timeRange(time: string | null, duration: number | null): string {
  if (!time) return "시간 미정";
  if (!duration) return time;
  const [hours, minutes] = time.split(":").map(Number);
  const end = hours * 60 + minutes + duration;
  const nextDay = Math.floor(end / 1440);
  return `${time}–${nextDay ? `다음 날 ${nextDay > 1 ? `+${nextDay}일 ` : ""}` : ""}${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")} · ${duration}분`;
}

export function DayActivityTimeline({ tripId, timezone, items, activities, startId, endId, onPlacePress }: {
  tripId: string; timezone?: string; items: ItineraryItem[]; activities: ItineraryActivity[]; startId?: string; endId?: string; onPlacePress: (id: string) => void;
}) {
  const entries = mergeDayTimeline(items, activities, startId, endId);
  return <View testID="day-activity-timeline" style={styles.list}>
    {entries.map((entry, index) => <View key={entry.id}>
      {index > 0 && <RouteConnector tripId={tripId} origin={entries[index - 1].place} destination={entry.place} timezone={timezone} />}
      <View style={styles.row}>
        <AppText variant="caption" color={colors.primary}>{entry.label} · {timeRange(entry.time, entry.duration)}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={`${entry.title} 지도에서 보기`} onPress={() => onPlacePress(entry.id)}>
          <AppText variant="label">{entry.title}</AppText>
        </Pressable>
        {Boolean(entry.detail) && <AppText variant="caption">{entry.detail}</AppText>}
      </View>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { borderLeftWidth: 2, borderColor: colors.primarySoft, padding: spacing.md, gap: spacing.xs, backgroundColor: colors.canvas },
});
