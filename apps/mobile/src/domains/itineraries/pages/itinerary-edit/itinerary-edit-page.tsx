import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { useItineraryEdit } from "./use-itinerary-edit";
import type { ItineraryItem } from "../../api/itineraries.api";

export default function ItineraryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { addUnplaced, dates, error, itinerary, loadTransitRoute, moveToAdjacentDay, moveWithinDay, reload, removeFromItinerary, routes, save, saving } = useItineraryEdit(tripId);
  const grouped = (itinerary?.items ?? []).reduce<Record<string, ItineraryItem[]>>((groups, item) => {
    const date = item.date ?? "미배치";
    (groups[date] ??= []).push(item);
    return groups;
  }, {});
  return (
    <Screen>
      <AppText variant="title">일정을 다듬어 보세요</AppText><AppText color={colors.muted}>미배치와 일정 포함 여부는 이 화면에서 관리합니다.</AppText>
      {error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
      {!itinerary && !error && <Card><AppText color={colors.muted}>일정을 불러오는 중이에요…</AppText></Card>}
      {dates.map((date, dayIndex) => {
        const items = (grouped[date] ?? []).toSorted((left, right) => (left.position ?? 0) - (right.position ?? 0));
        return <Card key={date}>
          <View style={styles.row}><AppText variant="heading">Day {dayIndex + 1}</AppText><Pill label={date} /></View>
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
              <Button label="제외" variant="danger" onPress={() => removeFromItinerary(item.id)} style={styles.dayAction} />
            </View>
            {nextItem && <View style={styles.route}>
              {route && route !== "loading" && route.status === "available" && <AppText variant="caption" color={colors.secondary}>대중교통 약 {route.durationMinutes}분{route.distanceMeters ? ` · ${(route.distanceMeters / 1000).toFixed(1)}km` : ""}</AppText>}
              {route && route !== "loading" && route.status === "unavailable" && <Pressable onPress={() => router.push(`/trips/${tripId}/exceptions/route-failure`)}><AppText variant="caption" color={colors.danger}>경로를 찾지 못했어요 · 자세히 보기</AppText></Pressable>}
              {!route || route === "loading" ? <Button label={route === "loading" ? "경로 확인 중…" : "다음 장소까지 대중교통"} disabled={route === "loading"} variant="ghost" onPress={() => void loadTransitRoute(item.savedPlaceId, nextItem.savedPlaceId)} /> : null}
            </View>}
          </View>;
          })}
        </Card>;
      })}
      {itinerary && <Card style={styles.unplaced}><View style={styles.row}><AppText variant="heading">미배치 장소</AppText><Pill label={`${itinerary.unplaced.length}곳`} selected /></View>{itinerary.unplaced.length === 0 ? <AppText color={colors.muted}>모든 장소가 일정에 포함됐어요.</AppText> : itinerary.unplaced.map((place) => <View key={place.savedPlaceId}><AppText>{place.placeName}</AppText><Button label="첫째 날에 추가" variant="ghost" onPress={() => addUnplaced(place.savedPlaceId)} /></View>)}</Card>}
      <AppText variant="heading">예외 상황 미리 보기</AppText>
      <Pressable onPress={() => router.push(`/trips/${tripId}/exceptions/schedule-conflict`)}><Card><AppText variant="label">일정 충돌 화면 →</AppText></Card></Pressable>
      <Pressable onPress={() => router.push(`/trips/${tripId}/exceptions/route-failure`)}><Card><AppText variant="label">대중교통 경로 실패 화면 →</AppText></Card></Pressable>
      <Button label={saving ? "저장 중…" : "일정 저장"} disabled={!itinerary || saving} onPress={() => void save().then((saved) => { if (saved) router.back(); })} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  place: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  placeCard: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  route: { paddingTop: spacing.sm },
  action: { minHeight: 40, width: 52, paddingHorizontal: spacing.xs },
  dayAction: { minHeight: 40, paddingHorizontal: spacing.sm },
  unplaced: { borderStyle: "dashed", borderColor: colors.secondary },
});
