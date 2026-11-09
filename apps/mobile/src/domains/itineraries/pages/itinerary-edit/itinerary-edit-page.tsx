import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import type { ItineraryItem } from "../../api/itineraries.api";
import { DayPlacePicker } from "./day-place-picker";
import { DayRouteMap } from "./day-route-map";
import { DraggableItineraryItem } from "./draggable-itinerary-item";
import { useItineraryDaySettings } from "./use-itinerary-day-settings";
import { useItineraryEdit } from "./use-itinerary-edit";

function dayLabel(date: string, index: number) {
  const parsed = new Date(`${date}T12:00:00`);
  const shortDate = parsed.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  return { day: `Day ${index + 1}`, date: shortDate };
}

export default function ItineraryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const {
    dates, error, itinerary, moveToAdjacentDay, places, reload,
    removeFromItinerary, reorderWithinDay, save, saving, setPlacesForDate,
    undoAiChange, undoing,
  } = useItineraryEdit(tripId);
  const daySettings = useItineraryDaySettings(tripId);
  const screenRef = useRef<ScrollViewInstance>(null);
  const [activeDate, setActiveDate] = useState<string>();
  const [mapFocusTarget, setMapFocusTarget] = useState<{ itemId: string; request: number }>();
  const [placePickerDay, setPlacePickerDay] = useState<{ date: string; index: number }>();
  const selectedDate = activeDate && dates.includes(activeDate) ? activeDate : dates[0];
  const dayIndex = Math.max(0, dates.indexOf(selectedDate));
  const grouped = (itinerary?.items ?? []).reduce<Record<string, ItineraryItem[]>>((groups, item) => {
    const date = item.date ?? "미배치";
    (groups[date] ??= []).push(item);
    return groups;
  }, {});
  const items = [...(grouped[selectedDate] ?? [])].sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const setting = daySettings.settings.find((candidate) => candidate.date === selectedDate);
  const primaryLodgingId = places.find((place) => place.isPrimaryLodging)?.id;

  const focusPlaceOnMap = (itemId: string) => {
    setMapFocusTarget((current) => ({ itemId, request: (current?.request ?? 0) + 1 }));
    screenRef.current?.scrollTo({ y: 0, animated: true });
  };

  return <Screen ref={screenRef}>
    <AppText variant="title">일정을 다듬어 보세요</AppText>
    <AppText color={colors.muted}>날짜를 고르고 지도 동선과 장소 순서를 편집하세요.</AppText>
    {error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
    {!itinerary && !error && <Card><AppText color={colors.muted}>일정을 불러오는 중이에요…</AppText></Card>}

    {dates.length > 0 && <ScrollView horizontal contentContainerStyle={styles.tabs} showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
      {dates.map((date, index) => {
        const label = dayLabel(date, index);
        const selected = date === selectedDate;
        return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={date} onPress={() => setActiveDate(date)} style={[styles.tab, selected && styles.selectedTab]} testID={`itinerary-date-tab-${date}`}>
          <AppText variant="label" color={selected ? colors.white : colors.ink}>{label.day}</AppText>
          <AppText variant="caption" color={selected ? colors.white : colors.muted}>{label.date}</AppText>
        </Pressable>;
      })}
    </ScrollView>}

    {selectedDate && <Card>
      <View style={styles.row}><AppText variant="heading">Day {dayIndex + 1}</AppText><Pill label={selectedDate} /></View>
      <DayRouteMap focusTarget={mapFocusTarget} items={items} />

      {setting && <View style={styles.daySettings}>
        <AppText variant="label">활동 시간</AppText>
        <View style={styles.timeRow}>
          <TextInput accessibilityLabel={`${selectedDate} 시작 시간`} value={setting.startTime} onChangeText={(startTime) => daySettings.update(selectedDate, { startTime })} placeholder="09:00" style={styles.timeInput} />
          <AppText color={colors.muted}>–</AppText>
          <TextInput accessibilityLabel={`${selectedDate} 종료 시간`} value={setting.endTime} onChangeText={(endTime) => daySettings.update(selectedDate, { endTime })} placeholder="21:00" style={styles.timeInput} />
        </View>
      </View>}

      <View style={styles.scheduleHeader}>
        <AppText variant="heading">방문 일정</AppText>
        {items.length > 0 && <AppText variant="caption" color={colors.muted}>⠇를 끌어 이동</AppText>}
      </View>
      {items.length === 0 && <AppText color={colors.muted}>아직 배치된 장소가 없어요.</AppText>}
      <View style={styles.placeList}>
        {items.map((item, placeIndex) => {
          const fixedLodgingLabel = item.savedPlaceId === primaryLodgingId
            ? placeIndex === 0 ? "하루 시작 숙소" : placeIndex === items.length - 1 ? "하루 종료 숙소" : undefined
            : undefined;
          return <DraggableItineraryItem
            canMoveToNextDay={dayIndex < dates.length - 1}
            canMoveToPreviousDay={dayIndex > 0}
            index={placeIndex}
            itemCount={items.length}
            key={item.id}
            fixedLabel={fixedLodgingLabel}
            onMoveToDay={(direction) => {
              const targetDate = dates[dayIndex + direction];
              moveToAdjacentDay(item.id, direction);
              if (targetDate) setActiveDate(targetDate);
            }}
            onPress={() => focusPlaceOnMap(item.id)}
            onRemove={() => removeFromItinerary(item.id)}
            onReorder={(targetIndex) => reorderWithinDay(item.id, targetIndex)}
            placeName={item.placeName}
          />;
        })}
      </View>
      <AppText variant="caption" color={colors.muted}>위·아래로 끌면 순서가, 좌·우로 끌면 날짜가 바뀌어요.</AppText>
      <Button label="＋ 여행 장소 추가" variant="ghost" testID={`itinerary-add-places-${selectedDate}`} onPress={() => setPlacePickerDay({ date: selectedDate, index: dayIndex })} />
    </Card>}

    {daySettings.message && <AppText color={colors.secondary}>{daySettings.message}</AppText>}
    <Button label={daySettings.saving ? "시간 저장 중…" : "날짜별 활동 시간 저장"} disabled={daySettings.loading || daySettings.saving || daySettings.settings.length === 0} variant="secondary" testID="itinerary-day-settings-save" onPress={() => void daySettings.save()} />
    <Button label={saving ? "저장 중…" : "일정 저장"} disabled={!itinerary || saving} testID="itinerary-save" onPress={() => void save().then((saved) => { if (saved) router.back(); })} />
    <Button label={undoing ? "되돌리는 중…" : "최근 AI 변경 한 번 되돌리기"} disabled={undoing} variant="ghost" onPress={() => void undoAiChange()} />
    {placePickerDay && <DayPlacePicker tripId={tripId} date={placePickerDay.date} dayIndex={placePickerDay.index} items={itinerary?.items ?? []} places={places} onApply={setPlacesForDate} onClose={() => setPlacePickerDay(undefined)} />}
  </Screen>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tabs: { gap: spacing.sm, paddingRight: spacing.lg },
  tabScroll: { flexGrow: 0, marginHorizontal: -spacing.lg, paddingLeft: spacing.lg },
  tab: { minWidth: 88, gap: 2, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedTab: { borderColor: colors.primary, backgroundColor: colors.primary },
  daySettings: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.ink },
  scheduleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  placeList: { gap: spacing.sm },
});
