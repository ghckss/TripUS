import { PropsWithChildren } from "react";
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";

export function Screen({ children, contentStyle }: PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle> }>) {
  const network = useNetInfo();
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">
    {network.isConnected === false && <View accessibilityLiveRegion="polite" style={styles.offlineBanner}>
      <AppText variant="caption" color={colors.warning}>오프라인 상태예요. 마지막으로 저장된 정보를 보여드려요.</AppText>
    </View>}
    {children}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  offlineBanner: { backgroundColor: "#FFF1D6", borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
