import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import type { ItineraryItem } from "../../api/itineraries.api";
import { useTransitLeg } from "./use-transit-leg";

export function RouteConnector({ tripId, origin, destination, timezone }: {
  tripId: string; origin: ItineraryItem; destination: ItineraryItem; timezone?: string;
}) {
  const result = useTransitLeg(tripId, origin, destination, timezone);
  const modeLabel = result.travelMode === "walking" ? "도보 " : result.travelMode === "car" ? "차량 " : "";
  return <View style={styles.connector} testID={`route-connector-${origin.id}-${destination.id}`}>
    <View style={styles.line} />
    {result.status === "loading"
      ? <ActivityIndicator size="small" color={colors.secondary} accessibilityLabel="이동 시간 계산 중" testID={`route-loading-${destination.id}`} />
      : result.status === "unavailable"
        ? <Pressable accessibilityRole="button" accessibilityLabel="이동 시간 다시 조회" onPress={result.retry} hitSlop={8}>
          <AppText variant="caption" color={colors.secondary}>확인 불가 · 다시 조회</AppText>
        </Pressable>
        : <AppText variant="caption" color={colors.muted} accessibilityLabel={`이동 시간 ${result.durationMinutes}분`}>
          {`${modeLabel}${result.durationMinutes}분`}
        </AppText>}
  </View>;
}
const styles = StyleSheet.create({
  connector: { height: 44, paddingLeft: 67, flexDirection: "row", alignItems: "center", gap: spacing.md },
  line: { width: 2, height: 44, backgroundColor: colors.line },
});
