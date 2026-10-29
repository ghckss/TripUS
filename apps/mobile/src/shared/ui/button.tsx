import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { colors, radius, spacing } from "@/shared/design/tokens";

type ButtonProps = { label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean; style?: StyleProp<ViewStyle> };

export function Button({ label, onPress, variant = "primary", disabled, style }: ButtonProps) {
  const foreground = variant === "primary" || variant === "danger" ? colors.white : colors.ink;
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, disabled && styles.disabled, style]}>
      <AppText variant="label" color={foreground}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.primary }, secondary: { backgroundColor: colors.secondarySoft },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.4 },
});
