import { useState } from "react";
import { router } from "expo-router";

import { deleteAccount, logout } from "@/domains/auth/api/auth.api";
import { colors } from "@/shared/design/tokens";
import { useAppDialog } from "@/shared/ui/app-dialog";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EditorialHeading } from "@/shared/ui/field-notes";
import { Screen } from "@/shared/ui/screen";
import { useProfile } from "./use-profile";

export default function ProfileScreen() {
  const { showDialog } = useAppDialog();
  const [deleting, setDeleting] = useState(false);
  const { entitlements, loading, user } = useProfile();
  const tierLabel = entitlements?.tier === "plus" ? "Plus" : entitlements?.tier === "free" ? "Free" : undefined;
  return <Screen contentStyle={{ paddingTop: 64 }}>
    <EditorialHeading eyebrow="MY NOTEBOOK" title="나의 여행 수첩" />
    <Card>
      <AppText variant="heading">{user?.displayName ?? "여행자"}</AppText>
      <AppText color={colors.muted}>{user?.email ?? "로그인 정보를 불러오는 중이에요."}</AppText>
      <AppText color={colors.muted}>인증 토큰은 기기의 보안 저장소에만 보관합니다.</AppText>
    </Card>
    <Card>
      <AppText variant="heading">{loading || !tierLabel ? "플랜 확인 중…" : `${tierLabel} 플랜`}</AppText>
      {entitlements && <>
        <AppText color={colors.muted}>여행 {entitlements.tripCount}{entitlements.tripLimit === null ? "개" : `/${entitlements.tripLimit}개`}</AppText>
        <AppText color={colors.muted}>AI 일정 생성 {entitlements.aiGenerationsUsed}{entitlements.aiGenerationLimit === null ? "회" : `/${entitlements.aiGenerationLimit}회`}</AppText>
      </>}
      <AppText variant="caption" color={colors.muted}>원본 사진 저장 용량은 플랜과 관계없이 제한하지 않아요.</AppText>
      {entitlements?.tier === "free" && <Button label="Plus 알아보기" variant="secondary" testID="profile-upgrade-plan" onPress={() => router.push("/profile/upgrade")} />}
    </Card>
    <Button label="로그아웃" variant="ghost" onPress={() => void logout().finally(() => router.replace("/(auth)/login"))} />
    <Button label={deleting ? "계정 삭제 중…" : "계정 탈퇴"} disabled={deleting} variant="danger" onPress={() => showDialog({
      title: "TripUS 계정을 탈퇴할까요?",
      message: "모든 여행, 일정, 사진과 기록이 영구 삭제되며 복구할 수 없어요.",
      actions: [
        { label: "취소", variant: "ghost" },
        { label: "계정 탈퇴", variant: "danger", onPress: () => {
          setDeleting(true);
          void deleteAccount()
            .then(() => router.replace("/(auth)/login"))
            .catch(() => showDialog({ title: "계정을 삭제하지 못했어요", message: "잠시 후 다시 시도해 주세요.", actions: [{ label: "확인" }] }))
            .finally(() => setDeleting(false));
        } },
      ],
    })} />
  </Screen>;
}
