import { Href, router, Stack } from "expo-router";
import { clearLastNotificationResponseAsync, useLastNotificationResponse } from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppQueryProvider } from "@/shared/query/query-provider";

import { colors } from "@/shared/design/tokens";
import "@/shared/notifications/configure-notifications";
import { AppErrorBoundary } from "@/shared/errors/app-error-boundary";
import { AppDialogProvider } from "@/shared/ui/app-dialog";

export const unstable_settings = { anchor: "(tabs)" };

function NotificationNavigation() {
  const notificationResponse = useLastNotificationResponse();

  useEffect(() => {
    const path = notificationResponse?.notification.request.content.data?.path;
    if (typeof path !== "string" || !path.startsWith("/trips/")) return;
    router.push(path as Href);
    void clearLastNotificationResponseAsync();
  }, [notificationResponse]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSerifKR: require("../../assets/fonts/NotoSerifKR.ttf"),
    NotoSansKR: require("../../assets/fonts/NotoSansKR.ttf"),
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppQueryProvider>
            <AppDialogProvider>
              <NotificationNavigation />
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerBackButtonDisplayMode: "minimal",
                  headerShadowVisible: false,
                  headerStyle: { backgroundColor: colors.canvas },
                  headerTintColor: colors.ink,
                  headerTitleStyle: { fontFamily: "NotoSansKR", fontSize: 14, fontWeight: "400" },
                  contentStyle: { backgroundColor: colors.canvas },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="save-place" options={{ title: "장소 저장", presentation: "card", animation: "slide_from_right" }} />
                <Stack.Screen name="profile/upgrade" options={{ title: "Plus 플랜", presentation: "card", animation: "slide_from_right" }} />
                <Stack.Screen name="trips/new" options={{ title: "새 여행", presentation: "card", animation: "slide_from_right", gestureEnabled: false }} />
                <Stack.Screen name="trips/[tripId]" options={{ headerShown: false, presentation: "card", animation: "slide_from_right", gestureEnabled: false }} />
              </Stack>
            </AppDialogProvider>
          </AppQueryProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
