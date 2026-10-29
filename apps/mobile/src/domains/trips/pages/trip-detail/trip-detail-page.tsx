import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { mockTrip } from "@/domains/trips/model/trip.fixture";

export default function TripHomeScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const path = `/trips/${tripId}` as const;
  return (
    <Screen>
      <View style={styles.row}><Pill label="D-2" selected /><AppText variant="caption" color={colors.muted}>{mockTrip.travelers}명</AppText></View>
      <AppText variant="title">{mockTrip.title}</AppText><AppText color={colors.muted}>{mockTrip.dates}</AppText>
      <Card style={styles.progress}><AppText variant="heading">준비가 한창이에요</AppText><AppText color={colors.muted}>장소 3곳 저장 · 일정 2일 편성</AppText></Card>
      <Pressable onPress={() => router.push(`${path}/places`)}><Card><AppText variant="heading">📍 장소 보관함</AppText><AppText color={colors.muted}>저장한 모든 장소를 한 목록에서 확인해요.</AppText></Card></Pressable>
      <Pressable onPress={() => router.push(`${path}/ai-plan`)}><Card><AppText variant="heading">✨ AI 일정 만들기</AppText><AppText color={colors.muted}>여행 스타일을 고르면 목업 일정을 제안해요.</AppText></Card></Pressable>
      <Pressable onPress={() => router.push(`${path}/itinerary`)}><Card><AppText variant="heading">🗓 일정 편집</AppText><AppText color={colors.muted}>날짜 배치와 일정 포함 여부를 관리해요.</AppText></Card></Pressable>
      <Button label="여행 완료 정리" variant="secondary" onPress={() => router.push(`${path}/complete`)} />
    </Screen>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, progress: { marginVertical: spacing.sm, backgroundColor: colors.primarySoft } });
