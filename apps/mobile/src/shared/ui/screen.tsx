import { forwardRef, PropsWithChildren, type ReactNode } from "react";
import { Platform, ScrollView, StyleProp, StyleSheet, View, ViewStyle, type ScrollViewInstance, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";
import { GestureDetector, type NativeGesture } from "react-native-gesture-handler";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { KeyboardAvoidingContainer } from "@/shared/ui/keyboard-avoiding-container";

type ScreenProps = PropsWithChildren<Omit<ScrollViewProps, "contentContainerStyle"> & {
  contentStyle?: StyleProp<ViewStyle>;
  gesture?: NativeGesture;
  bottomSlot?: ReactNode;
}>;

export const Screen = forwardRef<ScrollViewInstance, ScreenProps>(function Screen({ children, contentStyle, gesture, bottomSlot, scrollEnabled = true, stickyHeaderIndices, testID, ...scrollProps }, ref) {
  const network = useNetInfo();
  const stickyOffset = network.isConnected === false ? 1 : 0;
  const resolvedStickyHeaders = stickyHeaderIndices?.map((index) => index + stickyOffset);
  const scrollView = <ScrollView {...scrollProps} ref={ref} stickyHeaderIndices={resolvedStickyHeaders} testID={testID} style={[styles.screen, scrollProps.style]} contentContainerStyle={[styles.content, contentStyle]} keyboardDismissMode={scrollProps.keyboardDismissMode ?? (Platform.OS === "ios" ? "interactive" : "on-drag")} keyboardShouldPersistTaps="handled" scrollEnabled={scrollEnabled}>
    {network.isConnected === false && <View accessibilityLiveRegion="polite" style={styles.offlineBanner}>
      <AppText variant="caption" color={colors.warning}>오프라인 상태예요. 마지막으로 저장된 정보를 보여드려요.</AppText>
    </View>}
    {children}
  </ScrollView>;
  const keyboardAwareScreen = <KeyboardAvoidingContainer>{scrollView}</KeyboardAvoidingContainer>;
  const content = gesture ? <GestureDetector gesture={gesture}>{keyboardAwareScreen}</GestureDetector> : keyboardAwareScreen;
  return <View style={styles.screen}>{content}{bottomSlot && <SafeAreaView edges={["bottom"]} style={styles.bottom}>{bottomSlot}</SafeAreaView>}</View>;
});
const styles = StyleSheet.create({
  bottom: { backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  offlineBanner: { backgroundColor: "#FFF1D6", borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
