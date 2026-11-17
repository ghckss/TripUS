import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "@/shared/design/tokens";
import { AppText } from "./app-text";
import { FieldIcon } from "./field-notes";

export function TripNavigation({ tripId, active, allowActiveNavigation = false, onNavigate }: { tripId: string; active: "home" | "places" | "itinerary" | "record"; allowActiveNavigation?: boolean; onNavigate?: (navigate: () => void) => void }) {
  const links = [
    { key: "home", label: "여행", icon: "home", path: `/trips/${tripId}` },
    { key: "places", label: "장소", icon: "bookmark", path: `/trips/${tripId}/places` },
    { key: "itinerary", label: "일정", icon: "route", path: `/trips/${tripId}/itinerary` },
    { key: "record", label: "기록", icon: "journal", path: `/trips/${tripId}/complete` },
  ] as const;
  return <View style={styles.navigation}>{links.map((link) => <Pressable key={link.key} accessibilityRole="tab" accessibilityLabel={link.label} accessibilityState={{ selected: active === link.key }} onPress={() => { if (active === link.key && !allowActiveNavigation) return; const navigate = () => router.dismissTo(link.path); if (onNavigate) onNavigate(navigate); else navigate(); }} style={styles.navItem}>
    <FieldIcon name={link.icon} color={active === link.key ? colors.primary : colors.muted} />
    <AppText variant="micro" color={active === link.key ? colors.primary : colors.muted}>{link.label}</AppText>
  </Pressable>)}</View>;
}
const styles = StyleSheet.create({
  navigation: { flexDirection: "row", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  navItem: { flex: 1, minHeight: 60, paddingVertical: spacing.sm, alignItems: "center", justifyContent: "center", gap: spacing.xs },
});
