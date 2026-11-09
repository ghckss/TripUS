import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

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
    dates, error, itinerary, loadTransitRoute, moveToAdjacentDay, places, reload,
    removeFromItinerary, reorderWithinDay, routes, save, saving, setPlacesForDate,
    undoAiChange, undoing,
  } = useItineraryEdit(tripId);
  const daySettings = useItineraryDaySettings(tripId);
  const [activeDate, setActiveDate] = useState<string>();
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

  return <Screen>
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
      <DayRouteMap items={items} />

      {setting && <View style={styles.daySettings}>
        <AppText variant="label">활동 시간</AppText>
        <View style={styles.timeRow}>
          <TextInput accessibilityLabel={`${selectedDate} 시작 시간`} value={setting.startTime} onChangeText={(startTime) => daySettings.update(selectedDate, { startTime })} placeholder="09:00" style={styles.timeInput} />
          <AppText color={colors.muted}>–</AppText>
          <TextInput accessibilityLabel={`${selectedDate} 종료 시간`} value={setting.endTime} onChangeText={(endTime) => daySettings.update(selectedDate, { endTime })} placeholder="21:00" style={styles.timeInput} />
        </View>
        <AppText variant="label">출발 숙소</AppText>
        <View style={styles.pills}>
          <Pill label="지정 안 함" selected={!setting.startPlaceId} onPress={() => daySettings.update(selectedDate, { startPlaceId: null })} />
          {daySettings.lodgings.map((place) => <Pill key={`start-${selectedDate}-${place.id}`} label={place.name} selected={setting.startPlaceId === place.id} onPress={() => daySettings.update(selectedDate, { startPlaceId: place.id })} />)}
        </View>
        <AppText variant="label">종료 숙소</AppText>
        <View style={styles.pills}>
          <Pill label="지정 안 함" selected={!setting.endPlaceId} onPress={() => daySettings.update(selectedDate, { endPlaceId: null })} />
          {daySettings.lodgings.map((place) => <Pill key={`end-${selectedDate}-${place.id}`} label={place.name} selected={setting.endPlaceId === place.id} onPress={() => daySettings.update(selectedDate, { endPlaceId: place.id })} />)}
        </View>
      </View>}

      <View style={styles.scheduleHeader}>
        <AppText variant="heading">방문 일정</AppText>
        {items.length > 0 && <AppText variant="caption" color={colors.muted}>⠇를 끌어 이동</AppText>}
      </View>
      {items.length === 0 && <AppText color={colors.muted}>아직 배치된 장소가 없어요.</AppText>}
      <View style={styles.placeList}>
        {items.map((item, placeIndex) => {
          const nextItem = items[placeIndex + 1];
          const route = nextItem ? routes[`${item.savedPlaceId}:${nextItem.savedPlaceId}`] : undefined;
          return <DraggableItineraryItem
            canMoveToNextDay={dayIndex < dates.length - 1}
            canMoveToPreviousDay={dayIndex > 0}
            index={placeIndex}
            itemCount={items.length}
            key={item.id}
            onMoveToDay={(direction) => {
              const targetDate = dates[dayIndex + direction];
              moveToAdjacentDay(item.id, direction);
              if (targetDate) setActiveDate(targetDate);
            }}
            onRemove={() => removeFromItinerary(item.id)}
            onReorder={(targetIndex) => reorderWithinDay(item.id, targetIndex)}
            placeName={item.placeName}
          >
            {nextItem && <View style={styles.route}>
              {route && route !== "loading" && route.status === "available" && <AppText variant="caption" color={colors.secondary}>대중교통 약 {route.durationMinutes}분{route.distanceMeters ? ` · ${(route.distanceMeters / 1000).toFixed(1)}km` : ""}</AppText>}
              {route && route !== "loading" && route.status === "available" && <Button label="Google Maps에서 길 찾기" variant="ghost" onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(item.address ?? item.placeName)}&destination=${encodeURIComponent(nextItem.address ?? nextItem.placeName)}&travelmode=transit`)} />}
              {route && route !== "loading" && route.status === "unavailable" && <Pressable onPress={() => router.push(`/trips/${tripId}/exceptions/route-failure`)}><AppText variant="caption" color={colors.danger}>경로를 찾지 못했어요 · 자세히 보기</AppText></Pressable>}
              {!route || route === "loading" ? <Button label={route === "loading" ? "경로 확인 중…" : "다음 장소까지 대중교통"} disabled={route === "loading"} variant="ghost" onPress={() => void loadTransitRoute(item.savedPlaceId, nextItem.savedPlaceId)} /> : null}
            </View>}
          </DraggableItineraryItem>;
        })}
      </View>
      <AppText variant="caption" color={colors.muted}>위·아래로 끌면 순서가, 좌·우로 끌면 날짜가 바뀌어요.</AppText>
      <Button label="＋ 여행 장소 추가" variant="ghost" testID={`itinerary-add-places-${selectedDate}`} onPress={() => setPlacePickerDay({ date: selectedDate, index: dayIndex })} />
    </Card>}

    {!daySettings.loading && daySettings.lodgings.length === 0 && <Card>
      <AppText variant="heading">등록된 숙소가 없어요</AppText>
      <AppText color={colors.muted}>여행 정보에서 기본 숙소를 등록하면 날짜별 출발·종료 숙소로 선택할 수 있어요.</AppText>
      <Button label="여행 정보에서 숙소 등록" variant="ghost" onPress={() => router.push(`/trips/${tripId}/edit`)} />
    </Card>}
    {daySettings.message && <AppText color={colors.secondary}>{daySettings.message}</AppText>}
    <Button label={daySettings.saving ? "숙소 저장 중…" : "날짜별 숙소·시간 저장"} disabled={daySettings.loading || daySettings.saving || daySettings.settings.length === 0} variant="secondary" testID="itinerary-day-settings-save" onPress={() => void daySettings.save()} />
    <Button label={saving ? "저장 중…" : "일정 저장"} disabled={!itinerary || saving} testID="itinerary-save" onPress={() => void save().then((saved) => { if (saved) router.back(); })} />
    <Button label={undoing ? "되돌리는 중…" : "최근 AI 변경 한 번 되돌리기"} disabled={undoing} variant="ghost" onPress={() => void undoAiChange()} />
    {placePickerDay && <DayPlacePicker date={placePickerDay.date} dayIndex={placePickerDay.index} items={itinerary?.items ?? []} places={places} onApply={setPlacesForDate} onClose={() => setPlacePickerDay(undefined)} />}
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
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  scheduleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  placeList: { gap: spacing.sm },
  route: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
});
