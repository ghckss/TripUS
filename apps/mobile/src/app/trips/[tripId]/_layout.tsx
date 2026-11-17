import { router, Stack, useNavigation } from "expo-router";
import { useCallback } from "react";
import { colors } from "@/shared/design/tokens";
import { TripWorkspaceContext, WorkspaceBackButton } from "@/shared/ui/trip-workspace";

/** A single workspace sits above the original tab; internal pages share its stack. */
export default function TripWorkspaceLayout() {
  const root = useNavigation("/");
  const close = useCallback(() => {
    if (root.canGoBack()) root.goBack();
    else router.replace("/(tabs)/trips");
  }, [root]);
  const editor = { presentation: "card", animation: "slide_from_right", gestureEnabled: false } as const;
  return <TripWorkspaceContext.Provider value={close}>
    <Stack screenOptions={{
      headerBackButtonDisplayMode: "minimal", headerShadowVisible: false,
      headerLeft: ({ canGoBack }) => <WorkspaceBackButton onPress={canGoBack ? () => router.back() : close} />,
      headerStyle: { backgroundColor: colors.canvas }, headerTintColor: colors.ink,
      headerTitleStyle: { fontFamily: "NotoSansKR", fontSize: 14, fontWeight: "400" },
      contentStyle: { backgroundColor: colors.canvas }, animation: "slide_from_right", gestureEnabled: false,
    }}>
      <Stack.Screen name="index" options={{ title: "여행", headerLeft: () => <WorkspaceBackButton onPress={close} /> }} />
      <Stack.Screen name="places" options={{ title: "장소 보관함" }} />
      <Stack.Screen name="itinerary" options={{ title: "일정 다듬기" }} />
      <Stack.Screen name="summary" options={{ title: "여행 기록", headerBackVisible: false }} />
      <Stack.Screen name="edit" options={{ ...editor, title: "여행 수정" }} />
      <Stack.Screen name="places/new" options={{ ...editor, title: "장소 추가" }} />
      <Stack.Screen name="ai-plan" options={{ ...editor, title: "일정 만들기" }} />
      <Stack.Screen name="complete" options={{ ...editor, title: "여행 완료 정리" }} />
      <Stack.Screen name="recap" options={{ ...editor, title: "여행 캐러셀" }} />
      <Stack.Screen name="exceptions/schedule-conflict" options={{ title: "일정 충돌" }} />
      <Stack.Screen name="exceptions/route-failure" options={{ title: "경로를 찾지 못했어요" }} />
    </Stack>
  </TripWorkspaceContext.Provider>;
}
