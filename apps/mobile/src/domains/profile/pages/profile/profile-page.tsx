import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { colors } from "@/shared/design/tokens";
import { Button } from "@/shared/ui/button";
import { router } from "expo-router";
import { logout } from "@/domains/auth/api/auth.api";
import { useProfile } from "./use-profile";

export default function ProfileScreen() {
  const { entitlements, user } = useProfile();
  const tierLabel = entitlements?.tier === "plus" ? "Plus" : "Free";
  return <Screen contentStyle={{ paddingTop: 64 }}>
    <AppText variant="title">프로필</AppText>
    <Card>
      <AppText variant="heading">{user?.displayName ?? "여행자"}</AppText>
      <AppText color={colors.muted}>{user?.email ?? "로그인 정보를 불러오는 중이에요."}</AppText>
      <AppText color={colors.muted}>인증 토큰은 기기의 보안 저장소에만 보관합니다.</AppText>
    </Card>
    <Card>
      <AppText variant="heading">{tierLabel} 플랜</AppText>
      {entitlements && <>
        <AppText color={colors.muted}>여행 {entitlements.tripCount}{entitlements.tripLimit === null ? "개" : `/${entitlements.tripLimit}개`}</AppText>
        <AppText color={colors.muted}>AI 일정 생성 {entitlements.aiGenerationsUsed}{entitlements.aiGenerationLimit === null ? "회" : `/${entitlements.aiGenerationLimit}회`}</AppText>
      </>}
      <AppText variant="caption" color={colors.muted}>원본 사진 저장 용량은 플랜과 관계없이 제한하지 않아요.</AppText>
    </Card>
    <Button label="로그아웃" variant="ghost" onPress={() => void logout().finally(() => router.replace("/(auth)/login"))} />
  </Screen>;
}
