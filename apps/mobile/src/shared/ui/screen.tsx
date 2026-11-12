import { forwardRef, PropsWithChildren } from "react";
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle, type ScrollViewInstance, type ScrollViewProps } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { GestureDetector, type NativeGesture } from "react-native-gesture-handler";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";

type ScreenProps = PropsWithChildren<Omit<ScrollViewProps, "contentContainerStyle"> & {
  contentStyle?: StyleProp<ViewStyle>;
  gesture?: NativeGesture;
}>;

export const Screen = forwardRef<ScrollViewInstance, ScreenProps>(function Screen({ children, contentStyle, gesture, scrollEnabled = true, testID, ...scrollProps }, ref) {
  const network = useNetInfo();
  const scrollView = <ScrollView {...scrollProps} ref={ref} testID={testID} style={[styles.screen, scrollProps.style]} contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled" scrollEnabled={scrollEnabled}>
    {network.isConnected === false && <View accessibilityLiveRegion="polite" style={styles.offlineBanner}>
      <AppText variant="caption" color={colors.warning}>오프라인 상태예요. 마지막으로 저장된 정보를 보여드려요.</AppText>
    </View>}
    {children}
  </ScrollView>;
  return gesture ? <GestureDetector gesture={gesture}>{scrollView}</GestureDetector> : scrollView;
});
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  offlineBanner: { backgroundColor: "#FFF1D6", borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
