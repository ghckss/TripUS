import { PropsWithChildren } from "react";
import { ColorValue, StyleProp, StyleSheet, Text, TextProps, TextStyle } from "react-native";
import { colors } from "@/design/tokens";

type Variant = "display" | "title" | "heading" | "body" | "caption" | "label";
type AppTextProps = PropsWithChildren<TextProps & { variant?: Variant; color?: ColorValue; style?: StyleProp<TextStyle> }>;

export function AppText({ variant = "body", color = colors.ink, style, children, ...props }: AppTextProps) {
  return <Text {...props} style={[styles.base, styles[variant], { color }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  base: { fontFamily: "System" },
  display: { fontSize: 32, lineHeight: 39, fontWeight: "800", letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: "800", letterSpacing: -0.4 },
  heading: { fontSize: 19, lineHeight: 26, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  caption: { fontSize: 13, lineHeight: 19, fontWeight: "400" },
  label: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
});
