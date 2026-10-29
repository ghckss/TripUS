import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "@/shared/design/tokens";

export default function RootLayout() {
  return (
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
        <Stack.Screen name="trips/new" options={{ title: "새 여행" }} />
        <Stack.Screen name="trips/[tripId]/index" options={{ title: "여행" }} />
        <Stack.Screen name="trips/[tripId]/places" options={{ title: "장소 보관함" }} />
        <Stack.Screen name="trips/[tripId]/ai-plan" options={{ title: "여행 스타일" }} />
        <Stack.Screen name="trips/[tripId]/itinerary" options={{ title: "일정 편집" }} />
        <Stack.Screen name="trips/[tripId]/complete" options={{ title: "여행 완료 정리" }} />
        <Stack.Screen name="trips/[tripId]/summary" options={{ title: "여행 기록" }} />
        <Stack.Screen name="trips/[tripId]/exceptions/schedule-conflict" options={{ title: "일정 충돌" }} />
        <Stack.Screen name="trips/[tripId]/exceptions/route-failure" options={{ title: "경로를 찾지 못했어요" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
