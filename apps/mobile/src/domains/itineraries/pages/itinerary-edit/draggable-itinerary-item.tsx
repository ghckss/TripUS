import { Pressable, StyleSheet, View } from "react-native";
import { SortableItem } from "react-native-reanimated-dnd";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";

type Props = {
  index: number;
  itemCount: number;
  maxIndex?: number;
  minIndex?: number;
  placeName: string;
  fixed?: boolean;
  fixedLabel?: string;
  onEdit?: () => void;
  onPress: () => void;
  onRemove: () => void;
  onReorder: (targetIndex: number) => void;
};

export function DraggableItineraryItem({
  fixed = false,
  fixedLabel = "숙소",
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
      {!fixed ? <>
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
          <AppText numberOfLines={2} variant="label" style={styles.name}>{placeName}</AppText>
        </Pressable>
      </> : <>
        <View style={styles.fixedHandleSpacer} />
        <Pressable accessibilityLabel={`${placeName} 지도에서 보기`} accessibilityRole="button" onPress={onPress} style={styles.placeSummary}>
        <View style={styles.order}><AppText variant="caption" color={colors.white}>{index + 1}</AppText></View>
        <AppText numberOfLines={2} variant="label" style={styles.name}>{placeName}</AppText>
        </Pressable>
      </>}
      {fixed && onEdit && <Pressable accessibilityLabel={`${placeName} ${fixedLabel} 수정`} hitSlop={8} onPress={onEdit} style={styles.edit}>
        <AppText variant="label" color={colors.primary}>수정</AppText>
      </Pressable>}
      {!fixed && <Pressable accessibilityLabel={`${placeName} 일정에서 제외`} hitSlop={8} onPress={onRemove} style={styles.remove}>
        <AppText variant="heading" color={colors.muted}>×</AppText>
      </Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { height: 80, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  header: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dragHandle: { width: 32, minHeight: 44, alignItems: "center", justifyContent: "center" },
  fixedHandleSpacer: { width: 32 },
  placeContent: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  placeSummary: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  order: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  name: { flex: 1 },
  remove: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  edit: { minWidth: 44, minHeight: 40, alignItems: "center", justifyContent: "center" },
  travelRow: { marginTop: -spacing.xs, paddingLeft: 44 },
  details: { gap: 2, paddingLeft: 44 },
});
