import Constants from "expo-constants";
import { Image } from "expo-image";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { FieldIllustration } from "@/shared/ui/field-notes";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { useLogin } from "./use-login";

const googleMark = require("../../../../../assets/images/google-g.svg");

export default function LoginScreen() {
  const { error, googleConfigured, loading, loginForDevelopment, loginWithApple, loginWithGoogle } = useLogin();
  const appleSignInEnabled = Constants.expoConfig?.extra?.enableAppleSignIn === true;
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <AppText variant="caption" color={colors.primary} style={styles.eyebrow}>TRIPUS</AppText>
        <AppText variant="display">여행의 여백을{`\n`}나만의 이야기로.</AppText>
        <AppText color={colors.muted}>장소를 모으고, 나다운 일정을 만들고, 다녀온 순간을 기록하세요.</AppText>
        <FieldIllustration />
      </View>
      <Card>
        <AppText variant="heading">여행을 시작해 볼까요?</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={loading === "google" ? "Google 로그인 중…" : "Google로 계속하기"}
          accessibilityState={{ disabled: Boolean(loading) || !googleConfigured }}
          disabled={Boolean(loading) || !googleConfigured}
          onPress={() => void loginWithGoogle()}
          style={({ pressed }) => [
            styles.googleButton,
            pressed && styles.googleButtonPressed,
            (Boolean(loading) || !googleConfigured) && styles.googleButtonDisabled,
          ]}
          testID="login-google"
        >
          <Image source={googleMark} style={styles.googleMark} contentFit="contain" testID="login-google-mark" />
          <AppText variant="label" color={colors.ink}>{loading === "google" ? "Google 로그인 중…" : "Google로 계속하기"}</AppText>
        </Pressable>
        {Platform.OS === "ios" && appleSignInEnabled && <Button label={loading === "apple" ? "Apple 로그인 중…" : "Apple로 계속하기"} disabled={Boolean(loading)} variant="secondary" onPress={() => void loginWithApple()} />}
        {process.env.EXPO_PUBLIC_AUTH_MODE !== "production" && <Button label={loading === "development" ? "개발 로그인 중…" : "개발용 로그인"} disabled={Boolean(loading)} variant="ghost" testID="login-development" onPress={() => void loginForDevelopment()} />}
        {!googleConfigured && <AppText variant="caption" color={colors.muted}>Google 클라이언트 ID를 설정하면 소셜 로그인이 활성화돼요.</AppText>}
        {error && <AppText color={colors.danger}>{error}</AppText>}
      </Card>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "space-between", paddingTop: 72, gap: spacing.xxl },
  hero: { gap: spacing.md },
  eyebrow: { fontWeight: "700", letterSpacing: 2 },
  googleButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  googleButtonPressed: { opacity: 0.78 },
  googleButtonDisabled: { opacity: 0.4 },
  googleMark: { width: 18, height: 18 },
});
