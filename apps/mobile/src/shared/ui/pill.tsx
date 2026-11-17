import { Pressable, StyleSheet } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { colors, radius, spacing, touch } from "@/shared/design/tokens";

export function Pill({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityState={{ selected: Boolean(selected) }} disabled={!onPress} onPress={onPress} style={[styles.pill, selected && styles.selected]}>
    <AppText variant="caption" color={selected ? colors.primary : colors.muted} style={styles.label}>{label}</AppText>
  </Pressable>;
}
const styles = StyleSheet.create({ pill: { minHeight: touch.minimum, justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, label: { fontWeight: "500" } });
