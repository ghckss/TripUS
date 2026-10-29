import { Platform, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { useLogin } from "./use-login";

export default function LoginScreen() {
  const { error, googleConfigured, loading, loginForDevelopment, loginWithApple, loginWithGoogle } = useLogin();
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <AppText variant="caption" color={colors.primary} style={styles.eyebrow}>TRIPUS</AppText>
        <AppText variant="display">여행의 설렘부터{`\n`}기억까지 한곳에</AppText>
        <AppText color={colors.muted}>장소를 모으고, 나다운 일정을 만들고, 다녀온 순간을 기록하세요.</AppText>
      </View>
      <Card>
        <AppText variant="heading">여행을 시작해 볼까요?</AppText>
        <AppText color={colors.muted}>소셜 계정으로 안전하게 로그인하고 여행 기록을 동기화하세요.</AppText>
        <Button label={loading === "google" ? "Google 로그인 중…" : "Google로 계속하기"} disabled={Boolean(loading) || !googleConfigured} onPress={() => void loginWithGoogle()} />
        {Platform.OS === "ios" && <Button label={loading === "apple" ? "Apple 로그인 중…" : "Apple로 계속하기"} disabled={Boolean(loading)} variant="secondary" onPress={() => void loginWithApple()} />}
        {process.env.EXPO_PUBLIC_AUTH_MODE !== "production" && <Button label={loading === "development" ? "개발 로그인 중…" : "개발용 로그인"} disabled={Boolean(loading)} variant="ghost" onPress={() => void loginForDevelopment()} />}
        {!googleConfigured && <AppText variant="caption" color={colors.muted}>Google 클라이언트 ID를 설정하면 소셜 로그인이 활성화돼요.</AppText>}
        {error && <AppText color={colors.danger}>{error}</AppText>}
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { flexGrow: 1, justifyContent: "space-between", paddingTop: 96 }, hero: { gap: spacing.md }, eyebrow: { fontWeight: "800", letterSpacing: 2 } });
