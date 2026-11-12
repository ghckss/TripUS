import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing } from "@/shared/design/tokens";
import {
  type AiBudgetLevel,
  type AiTransportMode,
  type TravelStyle,
} from "../../api/itineraries.api";
import { useAiPlan } from "./use-ai-plan";
import { AiPlanLoadingScreen } from "./ai-plan-loading-screen";

const stylesList: { label: string; value: TravelStyle; description: string }[] = [
  { label: "균형 있게", value: "balanced", description: "명소와 휴식을 고르게 배치해요." },
  { label: "느긋하게", value: "relaxed", description: "하루 두 곳 정도로 여유롭게 구성해요." },
  { label: "핵심 명소", value: "highlights", description: "꼭 보고 싶은 장소를 먼저 배치해요." },
  { label: "맛집 중심", value: "food", description: "먹고 싶은 장소를 중심으로 구성해요." },
];
const transportOptions: { label: string; value: AiTransportMode }[] = [
  { label: "대중교통", value: "public_transit" },
  { label: "도보 위주", value: "walking" },
  { label: "자동차", value: "car" },
  { label: "혼합", value: "mixed" },
];
const budgetOptions: { label: string; value: AiBudgetLevel }[] = [
  { label: "가성비", value: "budget" },
  { label: "보통", value: "standard" },
  { label: "여유롭게", value: "premium" },
];

export default function AiPlanScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [selected, setSelected] = useState<TravelStyle>("relaxed");
  const [companions, setCompanions] = useState("");
  const [transportMode, setTransportMode] = useState<AiTransportMode>("public_transit");
  const [budgetLevel, setBudgetLevel] = useState<AiBudgetLevel>("standard");
  const [preferences, setPreferences] = useState("");
  const [avoidances, setAvoidances] = useState("");
  const { entitlements, error, generate, loading, missingRegions } = useAiPlan(tripId);
  const selectedStyle = stylesList.find((item) => item.value === selected)!;
  const createPlan = () => void generate({
    style: selected,
    companions: companions.trim() || undefined,
    transportMode,
    budgetLevel,
    preferences: preferences.trim() || undefined,
    avoidances: avoidances.trim() || undefined,
  }).then((created) => {
    if (created) router.replace(`/trips/${tripId}/itinerary`);
  });
  const confirmPlan = () => {
    const freeAttempt = entitlements?.tier === "free" && entitlements.aiGenerationsUsed === 0;
    if (!freeAttempt) { createPlan(); return; }
    Alert.alert("무료 AI 생성 1회를 사용할까요?", "성공한 일정 생성에만 횟수가 차감되며, 오류가 나면 차감하지 않아요.", [
      { text: "취소", style: "cancel" },
      { text: "일정 만들기", onPress: createPlan },
    ]);
  };
  if (loading) return <AiPlanLoadingScreen />;
  return (
    <Screen>
      <AppText variant="title">어떤 여행을 원하나요?</AppText>
      <AppText color={colors.muted}>저장한 장소를 중심으로 동선, 시간과 식사까지 빈틈없이 구성해요.</AppText>
      <AppText variant="label">여행 스타일</AppText>
      <View style={styles.wrap}>{stylesList.map((item) => <Pill key={item.value} label={item.label} selected={selected === item.value} onPress={() => setSelected(item.value)} />)}</View>
      <Card><AppText variant="heading">{selectedStyle.label} 둘러보는 일정</AppText><AppText color={colors.muted}>{selectedStyle.description}</AppText></Card>
      <View style={styles.field}>
        <AppText variant="label">동행자</AppText>
        <TextInput
          accessibilityLabel="동행자"
          onChangeText={setCompanions}
          placeholder="예: 부모님과 3명, 초등학생 아이 동반"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={companions}
        />
      </View>
      <View style={styles.field}>
        <AppText variant="label">이동 수단</AppText>
        <View style={styles.wrap}>{transportOptions.map((item) => <Pill key={item.value} label={item.label} selected={transportMode === item.value} onPress={() => setTransportMode(item.value)} />)}</View>
      </View>
      <View style={styles.field}>
        <AppText variant="label">예산</AppText>
        <View style={styles.wrap}>{budgetOptions.map((item) => <Pill key={item.value} label={item.label} selected={budgetLevel === item.value} onPress={() => setBudgetLevel(item.value)} />)}</View>
      </View>
      <View style={styles.field}>
        <AppText variant="label">좋아하는 것</AppText>
        <TextInput
          accessibilityLabel="좋아하는 것"
          multiline
          onChangeText={setPreferences}
          placeholder="예: 전시, 현지 맛집, 조용한 카페"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.multiline]}
          textAlignVertical="top"
          value={preferences}
        />
      </View>
      <View style={styles.field}>
        <AppText variant="label">피하고 싶은 것</AppText>
        <TextInput
          accessibilityLabel="피하고 싶은 것"
          multiline
          onChangeText={setAvoidances}
          placeholder="예: 하루 1만 보 이상, 긴 대기, 이른 아침"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.multiline]}
          textAlignVertical="top"
          value={avoidances}
        />
      </View>
      {missingRegions && <Card>
        <AppText variant="heading">도시/지역을 먼저 설정해 주세요</AppText>
        <AppText color={colors.muted}>현재 여행에는 도시/지역 정보가 없어 AI가 장소 주소만 보고 판단해요. 여러 지역을 설정하면 장거리 장소도 날짜별로 더 정확히 나눌 수 있어요.</AppText>
        <Button label="도시/지역 설정하기" variant="ghost" onPress={() => router.push(`/trips/${tripId}/edit`)} />
      </Card>}
      {error && <Card><AppText color={colors.danger}>{error}</AppText></Card>}
      <Button label="AI 일정 만들기" testID="ai-plan-generate" onPress={confirmPlan} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 88, paddingTop: spacing.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
