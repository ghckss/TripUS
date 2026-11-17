import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { EditorialHeading } from "@/shared/ui/field-notes";
import { TripNavigation } from "@/shared/ui/trip-navigation";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing, fonts } from "@/shared/design/tokens";
import {
  type AiBudgetLevel,
  type AiTransportMode,
  type TravelTheme,
} from "../../api/itineraries.api";
import { useAiPlan } from "./use-ai-plan";
import { AiPlanLoadingScreen } from "./ai-plan-loading-screen";
import { useAppDialog } from "@/shared/ui/app-dialog";

const themeOptions: { label: string; value: TravelTheme }[] = [
  { label: "맛집 탐방", value: "food" },
  { label: "대표 명소", value: "highlights" },
  { label: "카페·감성", value: "cafes" },
  { label: "문화·전시", value: "culture" },
  { label: "쇼핑", value: "shopping" },
  { label: "자연·휴식", value: "nature" },
];
const transportOptions: { label: string; value: AiTransportMode }[] = [
  { label: "대중교통", value: "public_transit" },
  { label: "도보 위주", value: "walking" },
  { label: "자동차", value: "car" },
];
const budgetOptions: { label: string; value: AiBudgetLevel }[] = [
  { label: "가성비", value: "budget" },
  { label: "보통", value: "standard" },
  { label: "여유롭게", value: "premium" },
];

const settingDescriptions = {
  themes: "맛집 탐방: 현지 식당과 지역 먹거리를 우선해요.\n대표 명소: 여행지를 대표하는 명소를 우선해요.\n카페·감성: 분위기 좋은 카페와 사진 명소를 담아요.\n문화·전시: 박물관, 미술관과 문화 공간을 둘러봐요.\n쇼핑: 시장, 상점과 쇼핑 거리를 포함해요.\n자연·휴식: 공원과 자연 경관을 여유롭게 둘러봐요.\n여러 방식을 선택하면 여행 전체에 함께 반영해요. 별도의 휴식·대기 일정은 추가하지 않아요.",
  budget: "가성비: 비용 부담이 적은 장소와 식사를 우선해요.\n보통: 가격과 만족도의 균형을 맞춰요.\n여유롭게: 특별한 경험과 인기 장소도 적극적으로 포함해요.",
};

function SettingLabel({ label, description }: { label: string; description: string }) {
  const { showDialog } = useAppDialog();
  return <View style={styles.settingLabel}>
    <AppText variant="label">{label}</AppText>
    <Pressable
      accessibilityLabel={`${label} 선택지 설명`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => showDialog({ title: label, message: description })}
      style={styles.infoButton}
    ><AppText color={colors.muted}>ⓘ</AppText></Pressable>
  </View>;
}

export default function AiPlanScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [themes, setThemes] = useState<TravelTheme[]>(["highlights"]);
  const [companions, setCompanions] = useState("");
  const [transportModes, setTransportModes] = useState<AiTransportMode[]>(["public_transit"]);
  const [budgetLevel, setBudgetLevel] = useState<AiBudgetLevel>("standard");
  const [additionalRequests, setAdditionalRequests] = useState("");
  const { showDialog } = useAppDialog();
  const { entitlements, error, generate, latestRequest, loading, missingRegions } = useAiPlan(tripId);
  const dirty = themes.join(",") !== "highlights" || transportModes.join(",") !== "public_transit" || budgetLevel !== "standard" || Boolean(companions || additionalRequests);
  const allowNavigation = useUnsavedChanges(dirty, loading);
  const loadLatestRequest = () => {
    if (!latestRequest) return;
    setThemes(latestRequest.themes);
    setCompanions(latestRequest.companions ?? "");
    setTransportModes(latestRequest.transportModes);
    setBudgetLevel(latestRequest.budgetLevel ?? "standard");
    setAdditionalRequests(latestRequest.additionalRequests ?? "");
  };
  const confirmLoadLatestRequest = () => {
    if (!latestRequest) {
      showDialog({ title: "불러올 최근 요청이 없어요" });
      return;
    }
    showDialog({
      title: "최근 설정을 불러올까요?",
      message: "현재 입력한 내용은 최근 요청 설정으로 바뀌어요.",
      actions: [
        { label: "취소", variant: "ghost" },
        { label: "불러오기", onPress: loadLatestRequest },
      ],
    });
  };
  const toggleTheme = (value: TravelTheme) => setThemes((current) => current.includes(value)
    ? current.length > 1 ? current.filter((item) => item !== value) : current
    : [...current, value]);
  const toggleTransportMode = (value: AiTransportMode) => setTransportModes((current) => current.includes(value)
    ? current.length > 1 ? current.filter((item) => item !== value) : current
    : [...current, value]);
  const createPlan = () => void generate({
    themes,
    companions: companions.trim() || undefined,
    transportModes,
    budgetLevel,
    additionalRequests: additionalRequests.trim() || undefined,
  }).then((created) => {
    if (created) { allowNavigation(); router.replace(`/trips/${tripId}/itinerary`); }
  });
  const confirmPlan = () => {
    const freeAttempt = entitlements?.tier === "free" && entitlements.aiGenerationsUsed === 0;
    if (!freeAttempt) { createPlan(); return; }
    showDialog({
      title: "무료 AI 생성 1회를 사용할까요?",
      message: "성공한 일정 생성에만 횟수가 차감되며, 오류가 나면 차감하지 않아요.",
      actions: [
        { label: "취소", variant: "ghost" },
        { label: "일정 만들기", onPress: createPlan },
      ],
    });
  };
  if (loading) return <AiPlanLoadingScreen />;
  return (
    <Screen bottomSlot={<TripNavigation allowActiveNavigation tripId={tripId} active="itinerary" />}>
      <View style={styles.titleRow}>
        <EditorialHeading eyebrow="PLAN YOUR TRIP" title={"어떤 여행을\n하고 싶으세요?"} />
        <Pressable
          accessibilityLabel="최근 요청 불러오기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={confirmLoadLatestRequest}
          style={({ pressed }) => [styles.loadButton, pressed && styles.loadButtonPressed]}
        ><AppText style={styles.loadIcon}>↻</AppText></Pressable>
      </View>
      <AppText color={colors.muted}>모아둔 장소로 하루를 제안해요. 순서와 방문 장소는 직접 바꿀 수 있어요.</AppText>
      <SettingLabel label="여행의 방식" description={settingDescriptions.themes} />
      <View style={styles.wrap}>{themeOptions.map((item) => <Pill key={item.value} label={item.label} selected={themes.includes(item.value)} onPress={() => toggleTheme(item.value)} />)}</View>
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
        <View style={styles.wrap}>{transportOptions.map((item) => <Pill key={item.value} label={item.label} selected={transportModes.includes(item.value)} onPress={() => toggleTransportMode(item.value)} />)}</View>
      </View>
      <View style={styles.field}>
        <SettingLabel label="예산" description={settingDescriptions.budget} />
        <View style={styles.wrap}>{budgetOptions.map((item) => <Pill key={item.value} label={item.label} selected={budgetLevel === item.value} onPress={() => setBudgetLevel(item.value)} />)}</View>
      </View>
      <View style={styles.field}>
        <AppText variant="label">추가 요청사항</AppText>
        <TextInput
          accessibilityLabel="추가 요청사항"
          multiline
          onChangeText={setAdditionalRequests}
          placeholder="예: 현지 맛집을 좋아하고, 긴 대기와 이른 아침 일정은 피하고 싶어요."
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.multiline]}
          textAlignVertical="top"
          value={additionalRequests}
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
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  loadButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.surface },
  loadButtonPressed: { backgroundColor: colors.primarySoft },
  loadIcon: { fontSize: 25, lineHeight: 28, color: colors.primary },
  settingLabel: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  infoButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  field: { gap: spacing.sm },
  input: { fontFamily: fonts.sans, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 88, paddingTop: spacing.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
