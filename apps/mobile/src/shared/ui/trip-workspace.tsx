import { router, type Href } from "expo-router";
import { createContext, useContext } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, touch } from "@/shared/design/tokens";

export const TripWorkspaceContext = createContext<(() => void) | undefined>(undefined);
export function useCloseTripWorkspace(fallback: Href = "/(tabs)/trips") {
  const close = useContext(TripWorkspaceContext);
  return close ?? (() => { if (router.canGoBack()) router.back(); else router.replace(fallback); });
}
export function WorkspaceBackButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="뒤로가기" accessibilityHint="이전 화면으로 돌아가기" onPress={onPress} style={styles.button}>
    <View accessibilityElementsHidden importantForAccessibility="no" style={styles.icon} />
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { width: touch.minimum, height: touch.minimum, alignItems: "center", justifyContent: "center" },
  icon: { width: 13, height: 13, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: colors.ink, transform: [{ rotate: "45deg" }], marginLeft: 4 },
});
