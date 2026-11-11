import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SortableItem } from "react-native-reanimated-dnd";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";

type Props = PropsWithChildren<{
  index: number;
  itemCount: number;
  maxIndex?: number;
  minIndex?: number;
  placeName: string;
  fixed?: boolean;
  fixedLabel?: string;
  scheduledTime?: string | null;
  durationMinutes?: number | null;
  activitySummary?: string | null;
  travelMethod?: string | null;
  travelDurationMinutes?: number | null;
  onEdit?: () => void;
  onPress: () => void;
  onRemove: () => void;
  onReorder: (targetIndex: number) => void;
}>;

export function DraggableItineraryItem({
  children,
  fixed = false,
  fixedLabel = "숙소",
  scheduledTime,
  durationMinutes,
  activitySummary,
  travelMethod,
  travelDurationMinutes,
  index,
  itemCount,
  maxIndex = itemCount - 1,
  minIndex = 0,
  onPress,
  onEdit,
  onRemove,
  onReorder,
  placeName,
}: Props) {
  const accessibilityActions = [
    ...(index > minIndex ? [{ name: "decrement" as const, label: "앞 순서로 이동" }] : []),
    ...(index < maxIndex ? [{ name: "increment" as const, label: "뒤 순서로 이동" }] : []),
  ];

  return <View style={styles.card}>
    <View style={styles.header}>
      {!fixed ? <View style={styles.dragSurface}>
        <SortableItem.Handle>
          <Pressable
            accessibilityActions={accessibilityActions}
            accessibilityHint="누른 채 위아래로 끌어 순서를 변경합니다"
            accessibilityLabel={`${placeName} 순서 이동`}
            accessibilityRole="adjustable"
            accessibilityValue={{ min: minIndex + 1, max: maxIndex + 1, now: index + 1 }}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "decrement") onReorder(index - 1);
              if (event.nativeEvent.actionName === "increment") onReorder(index + 1);
            }}
            style={styles.dragHandle}
            testID={`itinerary-drag-area-${placeName}`}
          >
            <AppText variant="heading" color={colors.primary}>⠿</AppText>
          </Pressable>
        </SortableItem.Handle>
        <Pressable accessibilityLabel={`${placeName} 지도에서 보기`} accessibilityRole="button" onPress={onPress} style={styles.placeContent}>
          <View style={styles.order}><AppText variant="caption" color={colors.white}>{index + 1}</AppText></View>
          <AppText variant="label" style={styles.name}>{placeName}</AppText>
        </Pressable>
      </View> : <Pressable accessibilityLabel={`${placeName} 지도에서 보기`} accessibilityRole="button" onPress={onPress} style={styles.placeSummary}>
        <View style={styles.order}><AppText variant="caption" color={colors.white}>{index + 1}</AppText></View>
        <AppText variant="label" style={styles.name}>{placeName}</AppText>
      </Pressable>}
      {fixed && onEdit && <Pressable accessibilityLabel={`${placeName} ${fixedLabel} 수정`} hitSlop={8} onPress={onEdit} style={styles.edit}>
        <AppText variant="label" color={colors.primary}>수정</AppText>
      </Pressable>}
      {!fixed && <Pressable accessibilityLabel={`${placeName} 일정에서 제외`} hitSlop={8} onPress={onRemove} style={styles.remove}>
        <AppText variant="heading" color={colors.muted}>×</AppText>
      </Pressable>}
    </View>
    {!fixed && (travelMethod || travelDurationMinutes != null) && <View style={styles.travelRow}>
      <AppText variant="caption" color={colors.secondary}>↳ {travelMethod ?? "이동"}{travelDurationMinutes != null ? ` 약 ${travelDurationMinutes}분` : ""}</AppText>
    </View>}
    {!fixed && (scheduledTime || durationMinutes || activitySummary) && <View style={styles.details}>
      {(scheduledTime || durationMinutes) && <AppText variant="caption" color={colors.primary}>
        {scheduledTime?.slice(0, 5) ?? "시간 미정"}{durationMinutes ? ` · ${durationMinutes}분` : ""}
      </AppText>}
      {activitySummary && <AppText variant="caption" color={colors.muted}>{activitySummary}</AppText>}
    </View>}
    {children}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  header: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dragSurface: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dragHandle: { width: 32, minHeight: 44, alignItems: "center", justifyContent: "center" },
  placeContent: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  placeSummary: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  order: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  name: { flex: 1 },
  remove: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  edit: { minWidth: 44, minHeight: 40, alignItems: "center", justifyContent: "center" },
  travelRow: { marginTop: -spacing.xs, paddingLeft: 44 },
  details: { gap: 2, paddingLeft: 44 },
});
