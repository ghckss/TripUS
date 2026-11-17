import { Image } from "expo-image";
import { Image as NativeImage, Pressable, StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from "react-native";
import { colors, spacing, touch } from "@/shared/design/tokens";
import { AppText } from "./app-text";

const icons = {
  home: require("../../../assets/field-notes/home.png"),
  bookmark: require("../../../assets/field-notes/bookmark.png"),
  route: require("../../../assets/field-notes/route.png"),
  journal: require("../../../assets/field-notes/journal.png"),
};
export function FieldIcon({ name, color = colors.muted }: { name: keyof typeof icons; color?: ColorValue }) {
  return <NativeImage source={icons[name]} resizeMode="contain" style={[styles.icon, { tintColor: color }]} accessibilityElementsHidden importantForAccessibility="no" />;
}
const illustrations = {
  journey: require("../../../assets/field-notes/journey.png"),
  cafe: require("../../../assets/field-notes/cafe.png"),
  park: require("../../../assets/field-notes/park.png"),
};
export function FieldIllustration({ kind = "journey", style }: { kind?: keyof typeof illustrations; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.illustration, kind !== "journey" && styles.thumbnail, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Image source={illustrations[kind]} contentFit="contain" style={styles.image} />
  </View>;
}
export function EditorialHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <View style={styles.heading}>
    {eyebrow && <AppText variant="micro" color={colors.primary} style={styles.eyebrow}>{eyebrow}</AppText>}
    <AppText variant="display">{title}</AppText>
    {description && <AppText color={colors.muted}>{description}</AppText>}
  </View>;
}
export function NotebookRow({ icon, title, description, onPress, testID }: { icon: keyof typeof icons; title: string; description: string; onPress: () => void; testID?: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} testID={testID} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <FieldIcon name={icon} color={colors.primary} />
    <View style={styles.rowText}><AppText variant="label">{title}</AppText><AppText variant="caption" color={colors.muted}>{description}</AppText></View>
    <AppText color={colors.muted}>›</AppText>
  </Pressable>;
}
const styles = StyleSheet.create({
  icon: { width: touch.icon, height: touch.icon },
  illustration: { width: "100%", aspectRatio: 398 / 170, overflow: "hidden" },
  thumbnail: { width: 68, height: 77, aspectRatio: undefined },
  image: { width: "100%", height: "100%" },
  heading: { gap: spacing.sm, paddingVertical: spacing.md },
  eyebrow: { letterSpacing: 1.1, fontWeight: "700" },
  row: { minHeight: 88, flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: spacing.md },
  rowText: { flex: 1, gap: spacing.xs },
  pressed: { opacity: 0.65 },
});
