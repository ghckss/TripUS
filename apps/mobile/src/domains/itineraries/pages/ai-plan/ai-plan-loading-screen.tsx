import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Screen } from "@/shared/ui/screen";

const fullPlanStages = [
  { title: "저장한 장소를 살펴보고 있어요", detail: "꼭 가고 싶은 곳과 여행 취향을 확인하고 있어요." },
  { title: "가까운 장소끼리 묶고 있어요", detail: "이동이 꼬이지 않도록 날짜별 동선을 만들고 있어요." },
  { title: "이동 시간을 계산하고 있어요", detail: "장소 사이의 이동 방법과 시간을 맞추고 있어요." },
  { title: "빈 시간에 어울리는 곳을 찾고 있어요", detail: "식사와 카페, 주변 추천 장소를 자연스럽게 채우고 있어요." },
  { title: "마지막으로 일정을 다듬고 있어요", detail: "무리한 시간이나 빠진 장소가 없는지 확인하고 있어요." },
] as const;

function loadingStages(dayLabel?: string) {
  if (!dayLabel) return fullPlanStages;
  return [
    { title: `${dayLabel} 장소를 살펴보고 있어요`, detail: "사용자가 추가한 장소와 최근 여행 설정을 확인하고 있어요." },
    { title: `${dayLabel} 동선을 다시 짜고 있어요`, detail: "다른 날짜는 그대로 두고 가까운 장소끼리 묶고 있어요." },
    { title: "이동 시간을 계산하고 있어요", detail: "장소 사이의 이동 방법과 도착 시간을 맞추고 있어요." },
    { title: "빈 시간에 어울리는 곳을 찾고 있어요", detail: "현지 경험을 더할 주변 장소를 자연스럽게 채우고 있어요." },
    { title: `${dayLabel} 일정을 마무리하고 있어요`, detail: "새 일정이 완전히 저장될 때까지 잠시만 기다려 주세요." },
  ] as const;
}

export function AiPlanLoadingScreen({ dayLabel }: { dayLabel?: string }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [rotation] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const rotationAnimation = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: 1800,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    const pulseAnimation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    rotationAnimation.start();
    pulseAnimation.start();
    const stages = loadingStages(dayLabel);
    const stageTimer = setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, stages.length - 1));
    }, 3500);
    return () => {
      clearInterval(stageTimer);
      rotationAnimation.stop();
      pulseAnimation.stop();
    };
  }, [dayLabel, pulse, rotation]);

  const stages = loadingStages(dayLabel);
  const stage = stages[stageIndex];
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return <Screen
    contentStyle={styles.screenContent}
    scrollEnabled={false}
    testID="ai-plan-loading"
  >
    <View accessibilityLiveRegion="polite" style={styles.copy}>
      <AppText variant="title" style={styles.title}>{stage.title}</AppText>
      <AppText color={colors.muted} style={styles.detail}>{stage.detail}</AppText>
    </View>

    <View accessibilityLabel={dayLabel ? `AI가 ${dayLabel} 일정을 업데이트하는 중` : "AI가 여행 일정을 생성하는 중"} accessibilityRole="progressbar" style={styles.animationArea}>
      <Animated.View style={[styles.orbit, { transform: [{ rotate }] }]}>
        <View style={styles.orbitDot} />
      </Animated.View>
      <Animated.View style={[styles.centerBubble, { transform: [{ scale }] }]}>
        <AppText style={styles.emoji}>🧭</AppText>
      </Animated.View>
    </View>

    <AppText variant="caption" color={colors.muted} style={styles.waitMessage}>
      여행 기간과 장소 수에 따라 잠시 시간이 걸릴 수 있어요.
    </AppText>
  </Screen>;
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1, justifyContent: "space-between", paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  copy: { gap: spacing.sm },
  title: { maxWidth: 300 },
  detail: { maxWidth: 320 },
  animationArea: { alignItems: "center", justifyContent: "center", alignSelf: "center", width: 220, height: 220 },
  orbit: { position: "absolute", width: 184, height: 184, borderRadius: radius.pill, borderWidth: 7, borderColor: colors.secondary },
  orbitDot: { position: "absolute", top: 14, right: 18, width: 14, height: 14, borderRadius: radius.pill, backgroundColor: colors.secondary },
  centerBubble: { width: 124, height: 124, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  emoji: { fontSize: 54, lineHeight: 66 },
  waitMessage: { textAlign: "center" },
});
