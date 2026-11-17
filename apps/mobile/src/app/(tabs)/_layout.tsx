import { Tabs } from "expo-router";
import { AppText } from "@/shared/ui/app-text";
import { FieldIcon } from "@/shared/ui/field-notes";
import { colors } from "@/shared/design/tokens";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 11, fontWeight: "500", fontFamily: "NotoSansKR" }, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line } }}>
      <Tabs.Screen name="trips/index" options={{ title: "내 여행", tabBarIcon: ({ color }) => <FieldIcon name="home" color={color} /> }} />
      <Tabs.Screen name="completed/index" options={{ title: "지난 여행", tabBarIcon: ({ color }) => <FieldIcon name="journal" color={color} /> }} />
      <Tabs.Screen name="profile/index" options={{ title: "프로필", tabBarIcon: ({ color }) => <AppText color={color} style={{ fontSize: 20 }}>☰</AppText> }} />
    </Tabs>
  );
}
