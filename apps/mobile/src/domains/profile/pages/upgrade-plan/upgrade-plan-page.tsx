import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { useUpgradePlan } from "./use-upgrade-plan";

const benefits = ["활성 여행을 제한 없이 만들 수 있어요.", "AI 일정을 횟수 제한 없이 생성할 수 있어요."];

export default function UpgradePlanScreen() {
  const { entitlements, error, loading, upgrade, upgrading } = useUpgradePlan();
  const upgraded = entitlements?.tier === "plus";
  const available = entitlements?.upgradeMode === "mock";

  return <Screen contentStyle={styles.content}>
    <View style={styles.hero}>
      <View style={styles.badge}><AppText variant="label" color={colors.primary}>TRIPUS PLUS</AppText></View>
      <AppText variant="display">여행은 더 자유롭게</AppText>
      <AppText color={colors.muted}>개수와 횟수를 신경 쓰지 않고 여행을 계획해 보세요.</AppText>
    </View>
    <Card>
      {benefits.map((benefit) => <View key={benefit} style={styles.benefit}>
        <AppText color={colors.success}>✓</AppText><AppText style={styles.benefitText}>{benefit}</AppText>
      </View>)}
    </Card>
    {loading ? <ActivityIndicator color={colors.primary} /> : upgraded ? <Card style={styles.successCard}>
      <AppText variant="heading" color={colors.success}>Plus 업그레이드가 완료됐어요</AppText>
      <AppText color={colors.muted}>새로운 플랜 혜택이 바로 적용됐어요.</AppText>
      <Button label="프로필로 돌아가기" onPress={() => router.back()} />
    </Card> : <>
      {available ? <AppText variant="caption" color={colors.muted}>테스트 환경에서는 실제 결제 없이 Plus 전환만 검증합니다.</AppText> : <AppText color={colors.muted}>Plus 결제 상품을 준비하고 있어요.</AppText>}
      {error && <AppText color={colors.danger} accessibilityLiveRegion="polite">{error}</AppText>}
      <Button label={upgrading ? "업그레이드 중…" : "Plus로 업그레이드"} disabled={!available || upgrading} testID="upgrade-plan-submit" onPress={() => void upgrade()} />
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.xl },
  hero: { gap: spacing.sm, paddingVertical: spacing.md },
  badge: { alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  benefit: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  benefitText: { flex: 1 },
  successCard: { borderColor: colors.success },
});
