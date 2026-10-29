import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";

const stylesList = ["느긋하게", "핵심 명소", "맛집 중심", "골목 탐험"];
export default function AiPlanScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [selected, setSelected] = useState("느긋하게");
  return (
    <Screen>
      <AppText variant="title">어떤 여행을 원하나요?</AppText><AppText color={colors.muted}>AI 일정은 여행 스타일 선택부터 시작합니다.</AppText>
      <View style={styles.wrap}>{stylesList.map((item) => <Pill key={item} label={item} selected={selected === item} onPress={() => setSelected(item)} />)}</View>
      <Card><AppText variant="heading">{selected} 둘러보는 일정</AppText><AppText color={colors.muted}>이동을 줄이고, 하루 2–3곳을 여유롭게 방문하도록 구성해요.</AppText><AppText variant="caption" color={colors.secondary}>첫 단계에서는 AI와 지도 경로를 목업으로 제공합니다.</AppText></Card>
      <Button label="목업 일정 만들기" onPress={() => router.replace(`/trips/${tripId}/itinerary`)} />
    </Screen>
  );
}
const styles = StyleSheet.create({ wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
