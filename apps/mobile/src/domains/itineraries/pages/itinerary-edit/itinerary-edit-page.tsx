import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { useItineraryEdit } from "./use-itinerary-edit";
import { useItineraryDaySettings } from "./use-itinerary-day-settings";
import { DayPlacePicker } from "./day-place-picker";
import type { ItineraryItem } from "../../api/itineraries.api";

export default function ItineraryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { dates, error, itinerary, loadTransitRoute, moveToAdjacentDay, moveWithinDay, places, reload, removeFromItinerary, routes, save, saving, setPlacesForDate, toggleLocked, undoAiChange, undoing } = useItineraryEdit(tripId);
  const daySettings = useItineraryDaySettings(tripId);
  const [placePickerDay, setPlacePickerDay] = useState<{ date: string; index: number }>();
  const grouped = (itinerary?.items ?? []).reduce<Record<string, ItineraryItem[]>>((groups, item) => {
    const date = item.date ?? "미배치";
    (groups[date] ??= []).push(item);
    return groups;
  }, {});
  return (
    <Screen>
      <AppText variant="title">일정을 다듬어 보세요</AppText><AppText color={colors.muted}>날짜별로 방문할 장소와 숙소를 설정하세요.</AppText>
      {error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
      {!itinerary && !error && <Card><AppText color={colors.muted}>일정을 불러오는 중이에요…</AppText></Card>}
      {dates.map((date, dayIndex) => {
        const items = [...(grouped[date] ?? [])].sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
        const setting = daySettings.settings.find((candidate) => candidate.date === date);
        return <Card key={date}>
          <View style={styles.row}><AppText variant="heading">Day {dayIndex + 1}</AppText><Pill label={date} /></View>
          {setting && <View style={styles.daySettings}>
            <AppText variant="label">활동 시간</AppText>
            <View style={styles.timeRow}>
              <TextInput accessibilityLabel={`${date} 시작 시간`} value={setting.startTime} onChangeText={(startTime) => daySettings.update(date, { startTime })} placeholder="09:00" style={styles.timeInput} />
              <AppText color={colors.muted}>–</AppText>
              <TextInput accessibilityLabel={`${date} 종료 시간`} value={setting.endTime} onChangeText={(endTime) => daySettings.update(date, { endTime })} placeholder="21:00" style={styles.timeInput} />
            </View>
            <AppText variant="label">출발 숙소</AppText>
            <View style={styles.pills}>
              <Pill label="지정 안 함" selected={!setting.startPlaceId} onPress={() => daySettings.update(date, { startPlaceId: null })} />
              {daySettings.lodgings.map((place) => <Pill key={`start-${date}-${place.id}`} label={place.name} selected={setting.startPlaceId === place.id} onPress={() => daySettings.update(date, { startPlaceId: place.id })} />)}
            </View>
            <AppText variant="label">종료 숙소</AppText>
            <View style={styles.pills}>
              <Pill label="지정 안 함" selected={!setting.endPlaceId} onPress={() => daySettings.update(date, { endPlaceId: null })} />
              {daySettings.lodgings.map((place) => <Pill key={`end-${date}-${place.id}`} label={place.name} selected={setting.endPlaceId === place.id} onPress={() => daySettings.update(date, { endPlaceId: place.id })} />)}
            </View>
          </View>}
          {items.length === 0 && <AppText color={colors.muted}>아직 배치된 장소가 없어요.</AppText>}
          {items.map((item, placeIndex) => {
            const nextItem = items[placeIndex + 1];
            const route = nextItem ? routes[`${item.savedPlaceId}:${nextItem.savedPlaceId}`] : undefined;
            return <View key={item.savedPlaceId} style={styles.placeCard}>
            <View style={styles.place}><AppText variant="caption" color={colors.primary}>{placeIndex + 1}</AppText><AppText variant="label">{item.placeName}</AppText></View>
            <View style={styles.actions}>
              <Button label="↑" variant="ghost" disabled={placeIndex === 0} onPress={() => moveWithinDay(item.id, -1)} style={styles.action} />
              <Button label="↓" variant="ghost" disabled={placeIndex === items.length - 1} onPress={() => moveWithinDay(item.id, 1)} style={styles.action} />
              <Button label="이전 날" variant="ghost" disabled={dayIndex === 0} onPress={() => moveToAdjacentDay(item.id, -1)} style={styles.dayAction} />
              <Button label="다음 날" variant="ghost" disabled={dayIndex === dates.length - 1} onPress={() => moveToAdjacentDay(item.id, 1)} style={styles.dayAction} />
              <Button label={item.locked ? "잠금 해제" : "일정 잠금"} variant="secondary" onPress={() => toggleLocked(item.id)} style={styles.dayAction} />
              <Button label="제외" variant="danger" onPress={() => removeFromItinerary(item.id)} style={styles.dayAction} />
            </View>
            {nextItem && <View style={styles.route}>
              {route && route !== "loading" && route.status === "available" && <AppText variant="caption" color={colors.secondary}>대중교통 약 {route.durationMinutes}분{route.distanceMeters ? ` · ${(route.distanceMeters / 1000).toFixed(1)}km` : ""}</AppText>}
              {route && route !== "loading" && route.status === "available" && <Button label="Google Maps에서 길 찾기" variant="ghost" onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(item.address ?? item.placeName)}&destination=${encodeURIComponent(nextItem.address ?? nextItem.placeName)}&travelmode=transit`)} />}
              {route && route !== "loading" && route.status === "unavailable" && <Pressable onPress={() => router.push(`/trips/${tripId}/exceptions/route-failure`)}><AppText variant="caption" color={colors.danger}>경로를 찾지 못했어요 · 자세히 보기</AppText></Pressable>}
              {!route || route === "loading" ? <Button label={route === "loading" ? "경로 확인 중…" : "다음 장소까지 대중교통"} disabled={route === "loading"} variant="ghost" onPress={() => void loadTransitRoute(item.savedPlaceId, nextItem.savedPlaceId)} /> : null}
            </View>}
          </View>;
          })}
          <Button label="＋ 여행 장소 추가" variant="ghost" testID={`itinerary-add-places-${date}`} onPress={() => setPlacePickerDay({ date, index: dayIndex })} />
        </Card>;
      })}
      {!daySettings.loading && daySettings.lodgings.length === 0 && <Card>
        <AppText variant="heading">등록된 숙소가 없어요</AppText>
        <AppText color={colors.muted}>여행 정보에서 기본 숙소를 등록하면 날짜별 출발·종료 숙소로 선택할 수 있어요.</AppText>
        <Button label="여행 정보에서 숙소 등록" variant="ghost" onPress={() => router.push(`/trips/${tripId}/edit`)} />
      </Card>}
      {daySettings.message && <AppText color={colors.secondary}>{daySettings.message}</AppText>}
      <Button label={daySettings.saving ? "숙소 저장 중…" : "날짜별 숙소·시간 저장"} disabled={daySettings.loading || daySettings.saving || daySettings.settings.length === 0} variant="secondary" testID="itinerary-day-settings-save" onPress={() => void daySettings.save()} />
      <Button label={saving ? "저장 중…" : "일정 저장"} disabled={!itinerary || saving} testID="itinerary-save" onPress={() => void save().then((saved) => { if (saved) router.back(); })} />
      <Button label={undoing ? "되돌리는 중…" : "최근 AI 변경 한 번 되돌리기"} disabled={undoing} variant="ghost" onPress={() => void undoAiChange()} />
      {placePickerDay && <DayPlacePicker
        date={placePickerDay.date}
        dayIndex={placePickerDay.index}
        items={itinerary?.items ?? []}
        places={places}
        onApply={setPlacesForDate}
        onClose={() => setPlacePickerDay(undefined)}
      />}
    </Screen>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  place: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  placeCard: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  route: { paddingTop: spacing.sm },
  daySettings: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.ink },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  action: { minHeight: 40, width: 52, paddingHorizontal: spacing.xs },
  dayAction: { minHeight: 40, paddingHorizontal: spacing.sm },
});
