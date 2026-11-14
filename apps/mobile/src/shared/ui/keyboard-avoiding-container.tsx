import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, StyleProp, StyleSheet, ViewStyle } from "react-native";

type KeyboardAvoidingContainerProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function KeyboardAvoidingContainer({ children, style }: KeyboardAvoidingContainerProps) {
  return <KeyboardAvoidingView
    behavior={Platform.OS === "ios" ? "padding" : "height"}
    style={[styles.container, style]}
  >
    {children}
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ container: { flex: 1 } });
