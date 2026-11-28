import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { TripNavigation } from "@/shared/ui/trip-navigation";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing, fonts } from "@/shared/design/tokens";
import { useAiPlan } from "./use-ai-plan";
import { AiPlanLoadingScreen } from "./ai-plan-loading-screen";
import { useAppDialog } from "@/shared/ui/app-dialog";

const requestExamples = [
  {
    image: require("../../../../../assets/ai-plan/request-shopping.png"),
    label: "쇼핑을 많이 하고 싶어요",
    request: "쇼핑 시간을 충분히 확보하고 현지 쇼핑 거리, 시장, 편집숍을 일정에 골고루 포함해 주세요.",
  },
  {
    image: require("../../../../../assets/ai-plan/request-local.png"),
    label: "현지인처럼 여행하고 싶어요",
    request: "유명 관광지는 최소화하고 현지인이 일상적으로 찾는 동네, 식당, 상점과 문화 공간을 중심으로 구성해 주세요.",
  },
  {
    image: require("../../../../../assets/ai-plan/request-nature.png"),
    label: "도시보다 자연이 더 좋아요",
    request: "도심 관광은 줄이고 공원, 산책로, 호수, 해변처럼 자연을 여유롭게 즐길 수 있는 일정으로 구성해 주세요.",
  },
] as const;

export default function AiPlanScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [additionalRequests, setAdditionalRequests] = useState("");
  const { showDialog } = useAppDialog();
  const { entitlements, error, generate, latestRequest, loading, missingRegions } = useAiPlan(tripId);
  const dirty = Boolean(additionalRequests);
  const allowNavigation = useUnsavedChanges(dirty, loading);
  const loadLatestRequest = () => {
    if (!latestRequest) return;
    setAdditionalRequests(latestRequest.additionalRequests ?? "");
  };
  const confirmLoadLatestRequest = () => {
    if (!latestRequest) {
      showDialog({ title: "불러올 최근 요청이 없어요" });
      return;
    }
    showDialog({
      title: "최근 설정을 불러올까요?",
      message: "현재 입력한 내용은 최근 추가 요청사항으로 바뀌어요.",
      actions: [
        { label: "취소", variant: "ghost" },
        { label: "불러오기", onPress: loadLatestRequest },
      ],
    });
  };
  const createPlan = () => {
    const request = additionalRequests.trim();
    void generate(request ? { additionalRequests: request } : {}).then((created) => {
    if (created) { allowNavigation(); router.replace(`/trips/${tripId}/itinerary`); }
    });
  };
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
        <AppText style={styles.question}>원하시는 여행을 저에게 알려주세요</AppText>
        <Pressable
          accessibilityLabel="최근 요청 불러오기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={confirmLoadLatestRequest}
          style={({ pressed }) => [styles.loadButton, pressed && styles.loadButtonPressed]}
        ><AppText style={styles.loadIcon}>↻</AppText></Pressable>
      </View>
      <View style={styles.examples}>
        <AppText color={colors.muted}>예시를 눌러 요청사항을 채워 보세요</AppText>
        {requestExamples.map((example) => (
          <Pressable
            accessibilityLabel={`예시 요청: ${example.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected: additionalRequests === example.request }}
            key={example.label}
            onPress={() => setAdditionalRequests(example.request)}
            style={({ pressed }) => [
              styles.exampleButton,
              additionalRequests === example.request && styles.exampleButtonSelected,
              pressed && styles.exampleButtonPressed,
            ]}
          >
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={example.image}
              style={styles.exampleImage}
            />
              <AppText
                color={additionalRequests === example.request ? colors.success : colors.ink}
                numberOfLines={1}
                style={styles.exampleText}
              >{example.label}</AppText>
          </Pressable>
        ))}
      </View>
      <View style={styles.field}>
        <AppText variant="label">추가 요청사항 (선택)</AppText>
        <TextInput
          accessibilityLabel="추가 요청사항"
          multiline
          onChangeText={setAdditionalRequests}
          placeholder="예: 부모님과 함께해요. 현지 맛집을 좋아하고 긴 대기와 이른 아침 일정은 피하고 싶어요."
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
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  loadButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.surface },
  loadButtonPressed: { backgroundColor: colors.primarySoft },
  loadIcon: { fontSize: 25, lineHeight: 28, color: colors.primary },
  question: { flex: 1, fontFamily: fonts.serif, fontSize: 27, lineHeight: 40, color: colors.ink },
  field: { gap: spacing.sm },
  input: { fontFamily: fonts.sans, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 190, paddingTop: spacing.md },
  examples: { gap: spacing.sm },
  exampleButton: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: spacing.compact, overflow: "hidden", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.sm },
  exampleButtonSelected: { borderColor: colors.success, backgroundColor: colors.successSoft },
  exampleButtonPressed: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  exampleImage: { width: 74, height: 66, borderRadius: radius.sm, backgroundColor: colors.secondarySoft },
  exampleText: { flex: 1 },
});
