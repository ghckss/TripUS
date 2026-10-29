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
  const { addUnplaced, error, itinerary, reload, save, saving } = useItineraryEdit(tripId);
  const days = Object.entries((itinerary?.items ?? []).reduce<Record<string, ItineraryItem[]>>((groups, item) => {
    const date = item.date ?? "미배치";
    (groups[date] ??= []).push(item);
    return groups;
  }, {}));
  return (
    <Screen>
      <AppText variant="title">일정을 다듬어 보세요</AppText><AppText color={colors.muted}>미배치와 일정 포함 여부는 이 화면에서 관리합니다.</AppText>
      {error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
      {!itinerary && !error && <Card><AppText color={colors.muted}>일정을 불러오는 중이에요…</AppText></Card>}
      {days.map(([date, items], index) => <Card key={date}><View style={styles.row}><AppText variant="heading">Day {index + 1}</AppText><Pill label={date} /></View>{items?.map((item, placeIndex) => <View key={item.savedPlaceId} style={styles.place}><AppText variant="caption" color={colors.primary}>{placeIndex + 1}</AppText><AppText>{item.placeName}</AppText></View>)}</Card>)}
      {itinerary && <Card style={styles.unplaced}><View style={styles.row}><AppText variant="heading">미배치 장소</AppText><Pill label={`${itinerary.unplaced.length}곳`} selected /></View>{itinerary.unplaced.length === 0 ? <AppText color={colors.muted}>모든 장소가 일정에 포함됐어요.</AppText> : itinerary.unplaced.map((place) => <View key={place.savedPlaceId}><AppText>{place.placeName}</AppText><Button label="첫째 날에 추가" variant="ghost" onPress={() => addUnplaced(place.savedPlaceId)} /></View>)}</Card>}
      <AppText variant="heading">예외 상황 미리 보기</AppText>
      <Pressable onPress={() => router.push(`/trips/${tripId}/exceptions/schedule-conflict`)}><Card><AppText variant="label">일정 충돌 화면 →</AppText></Card></Pressable>
      <Pressable onPress={() => router.push(`/trips/${tripId}/exceptions/route-failure`)}><Card><AppText variant="label">대중교통 경로 실패 화면 →</AppText></Card></Pressable>
      <Button label={saving ? "저장 중…" : "일정 저장"} disabled={!itinerary || saving} onPress={() => void save().then((saved) => { if (saved) router.back(); })} />
    </Screen>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, place: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: spacing.sm }, unplaced: { borderStyle: "dashed", borderColor: colors.secondary } });
