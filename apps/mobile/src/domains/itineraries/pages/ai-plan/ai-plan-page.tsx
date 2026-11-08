import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { type TravelStyle } from "../../api/itineraries.api";
import { useAiPlan } from "./use-ai-plan";

const stylesList: { label: string; value: TravelStyle; description: string }[] = [
  { label: "균형 있게", value: "balanced", description: "명소와 휴식을 고르게 배치해요." },
  { label: "느긋하게", value: "relaxed", description: "하루 두 곳 정도로 여유롭게 구성해요." },
  { label: "핵심 명소", value: "highlights", description: "꼭 보고 싶은 장소를 먼저 배치해요." },
  { label: "맛집 중심", value: "food", description: "먹고 싶은 장소를 중심으로 구성해요." },
];
export default function AiPlanScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [selected, setSelected] = useState<TravelStyle>("relaxed");
  const { entitlements, error, generate, loading } = useAiPlan(tripId);
  const selectedStyle = stylesList.find((item) => item.value === selected)!;
  const createPlan = () => void generate(selected).then((created) => { if (created) router.replace(`/trips/${tripId}/itinerary`); });
  const confirmPlan = () => {
    const freeAttempt = entitlements?.tier === "free" && entitlements.aiGenerationsUsed === 0;
    if (!freeAttempt) { createPlan(); return; }
    Alert.alert("무료 AI 생성 1회를 사용할까요?", "성공한 일정 생성에만 횟수가 차감되며, 오류가 나면 차감하지 않아요.", [
      { text: "취소", style: "cancel" },
      { text: "일정 만들기", onPress: createPlan },
    ]);
  };
  return (
    <Screen>
      <AppText variant="title">어떤 여행을 원하나요?</AppText><AppText color={colors.muted}>AI 일정은 여행 스타일 선택부터 시작합니다.</AppText>
      <View style={styles.wrap}>{stylesList.map((item) => <Pill key={item.value} label={item.label} selected={selected === item.value} onPress={() => setSelected(item.value)} />)}</View>
      <Card><AppText variant="heading">{selectedStyle.label} 둘러보는 일정</AppText><AppText color={colors.muted}>{selectedStyle.description}</AppText></Card>
      <Button label="숙소·날짜 설정 확인" variant="ghost" onPress={() => router.push(`/trips/${tripId}/settings`)} />
      {error && <Card><AppText color={colors.danger}>{error}</AppText></Card>}
      <Button label={loading ? "일정 만드는 중…" : "AI 일정 만들기"} disabled={loading} testID="ai-plan-generate" onPress={confirmPlan} />
    </Screen>
  );
}
const styles = StyleSheet.create({ wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } });
