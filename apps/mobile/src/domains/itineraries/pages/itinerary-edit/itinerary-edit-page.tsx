import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { mockDays } from "@/domains/itineraries/model/itinerary.fixture";

export default function ItineraryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return (
    <Screen>
      <AppText variant="title">일정을 다듬어 보세요</AppText><AppText color={colors.muted}>미배치와 일정 포함 여부는 이 화면에서 관리합니다.</AppText>
      {mockDays.map((day, index) => <Card key={day.date}><View style={styles.row}><AppText variant="heading">Day {index + 1}</AppText><Pill label={day.date} /></View>{day.places.length ? day.places.map((place, placeIndex) => <View key={place} style={styles.place}><AppText variant="caption" color={colors.primary}>{placeIndex + 1}</AppText><AppText>{place}</AppText></View>) : <AppText color={colors.muted}>아직 배치된 장소가 없어요.</AppText>}</Card>)}
      <Card style={styles.unplaced}><View style={styles.row}><AppText variant="heading">미배치 장소</AppText><Pill label="1곳" selected /></View><AppText>성수의 작은 카페</AppText><Button label="Day 2에 추가" variant="ghost" onPress={() => {}} /></Card>
      <AppText variant="heading">예외 상황 미리 보기</AppText>
      <Pressable onPress={() => router.push(`/trips/${tripId}/exceptions/schedule-conflict`)}><Card><AppText variant="label">일정 충돌 화면 →</AppText></Card></Pressable>
      <Pressable onPress={() => router.push(`/trips/${tripId}/exceptions/route-failure`)}><Card><AppText variant="label">대중교통 경로 실패 화면 →</AppText></Card></Pressable>
      <Button label="일정 저장" onPress={() => router.back()} />
    </Screen>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, place: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: spacing.sm }, unplaced: { borderStyle: "dashed", borderColor: colors.secondary } });
