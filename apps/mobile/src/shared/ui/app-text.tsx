import { PropsWithChildren } from "react";
import { ColorValue, StyleProp, StyleSheet, Text, TextProps, TextStyle } from "react-native";
import { colors, typography } from "@/shared/design/tokens";

type Variant = keyof typeof typography;
type AppTextProps = PropsWithChildren<TextProps & { variant?: Variant; color?: ColorValue; style?: StyleProp<TextStyle> }>;

export function AppText({ variant = "body", color = colors.ink, style, children, ...props }: AppTextProps) {
  return <Text {...props} style={[styles.base, styles[variant], { color }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  base: { flexShrink: 1 },
  ...typography,
});
