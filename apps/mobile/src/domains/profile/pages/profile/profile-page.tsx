import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { colors } from "@/shared/design/tokens";
import { Button } from "@/shared/ui/button";
import { router } from "expo-router";
import { logout } from "@/domains/auth/api/auth.api";
import { useProfile } from "./use-profile";

export default function ProfileScreen() {
  const user = useProfile();
  return <Screen contentStyle={{ paddingTop: 64 }}><AppText variant="title">프로필</AppText><Card><AppText variant="heading">{user?.displayName ?? "여행자"}</AppText><AppText color={colors.muted}>{user?.email ?? "로그인 정보를 불러오는 중이에요."}</AppText><AppText color={colors.muted}>인증 토큰은 기기의 보안 저장소에만 보관합니다.</AppText><Button label="로그아웃" variant="ghost" onPress={() => void logout().finally(() => router.replace("/(auth)/login"))} /></Card></Screen>;
}
