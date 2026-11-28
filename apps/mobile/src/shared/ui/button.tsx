import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { colors, radius, spacing, touch } from "@/shared/design/tokens";

type ButtonProps = { label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost" | "success" | "danger"; disabled?: boolean; style?: StyleProp<ViewStyle>; testID?: string; accessibilityLabel?: string };

export function Button({ label, onPress, variant = "primary", disabled, style, testID, accessibilityLabel }: ButtonProps) {
  const foreground = disabled
    ? colors.disabledText
    : variant === "primary" || variant === "success" || variant === "danger"
      ? colors.white
      : variant === "secondary" ? colors.primary : colors.ink;
  return (
    <Pressable accessibilityLabel={accessibilityLabel ?? label} accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} testID={testID}
      style={({ pressed }) => [styles.base, styles[variant], style, pressed && styles.pressed, disabled && styles.disabled]}>
      <AppText variant="label" color={foreground}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: touch.mainAction, borderRadius: radius.sm, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.primary }, secondary: { backgroundColor: colors.primarySoft },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  success: { backgroundColor: colors.success },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 1, backgroundColor: colors.disabledSurface, borderWidth: 1, borderColor: colors.disabledBorder },
});
