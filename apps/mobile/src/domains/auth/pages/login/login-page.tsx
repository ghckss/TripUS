import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";

export default function LoginScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <AppText variant="caption" color={colors.primary} style={styles.eyebrow}>TRIPUS</AppText>
        <AppText variant="display">여행의 설렘부터{`\n`}기억까지 한곳에</AppText>
        <AppText color={colors.muted}>장소를 모으고, 나다운 일정을 만들고, 다녀온 순간을 기록하세요.</AppText>
      </View>
      <Card>
        <AppText variant="heading">여행을 시작해 볼까요?</AppText>
        <AppText color={colors.muted}>현재는 핵심 흐름 검증을 위한 목업 로그인입니다.</AppText>
        <Button label="이메일로 계속하기" onPress={() => router.replace("/(tabs)/trips")} />
        <Button label="둘러보기" variant="ghost" onPress={() => router.replace("/(tabs)/trips")} />
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { flexGrow: 1, justifyContent: "space-between", paddingTop: 96 }, hero: { gap: spacing.md }, eyebrow: { fontWeight: "800", letterSpacing: 2 } });
