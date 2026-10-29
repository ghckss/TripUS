import { Pressable, StyleSheet } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { colors, radius, spacing } from "@/shared/design/tokens";

export function Pill({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable disabled={!onPress} onPress={onPress} style={[styles.pill, selected && styles.selected]}>
    <AppText variant="caption" color={selected ? colors.secondary : colors.muted} style={styles.label}>{label}</AppText>
  </Pressable>;
}
const styles = StyleSheet.create({ pill: { borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, selected: { backgroundColor: colors.secondarySoft, borderColor: colors.secondary }, label: { fontWeight: "700" } });
