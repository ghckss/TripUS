import { Href, router, Stack } from "expo-router";
import { clearLastNotificationResponseAsync, useLastNotificationResponse } from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/shared/design/tokens";
import "@/shared/notifications/configure-notifications";
import { AppErrorBoundary } from "@/shared/errors/app-error-boundary";

export default function RootLayout() {
  const notificationResponse = useLastNotificationResponse();

  useEffect(() => {
    const path = notificationResponse?.notification.request.content.data?.path;
    if (typeof path !== "string" || !path.startsWith("/trips/")) return;
    router.push(path as Href);
    void clearLastNotificationResponseAsync();
  }, [notificationResponse]);

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerBackButtonDisplayMode: "minimal",
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.canvas },
              headerTintColor: colors.ink,
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="save-place" options={{ title: "장소 저장" }} />
            <Stack.Screen name="profile/upgrade" options={{ title: "Plus 플랜" }} />
            <Stack.Screen name="trips/new" options={{ title: "새 여행" }} />
            <Stack.Screen name="trips/[tripId]/index" options={{ title: "여행" }} />
            <Stack.Screen name="trips/[tripId]/edit" options={{ title: "여행 수정" }} />
            <Stack.Screen name="trips/[tripId]/places" options={{ title: "장소 보관함" }} />
            <Stack.Screen name="trips/[tripId]/places/new" options={{ title: "장소 추가" }} />
            <Stack.Screen name="trips/[tripId]/ai-plan" options={{ title: "여행 스타일" }} />
            <Stack.Screen name="trips/[tripId]/itinerary" options={{ title: "일정 편집" }} />
            <Stack.Screen name="trips/[tripId]/complete" options={{ title: "여행 완료 정리" }} />
            <Stack.Screen name="trips/[tripId]/summary" options={{ title: "여행 기록" }} />
            <Stack.Screen name="trips/[tripId]/recap" options={{ title: "여행 캐러셀" }} />
            <Stack.Screen name="trips/[tripId]/exceptions/schedule-conflict" options={{ title: "일정 충돌" }} />
            <Stack.Screen name="trips/[tripId]/exceptions/route-failure" options={{ title: "경로를 찾지 못했어요" }} />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
