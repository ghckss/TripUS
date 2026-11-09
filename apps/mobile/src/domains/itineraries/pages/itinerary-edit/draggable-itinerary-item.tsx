import { PropsWithChildren, useMemo, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";

const VERTICAL_DRAG_STEP = 104;
const HORIZONTAL_DAY_THRESHOLD = 72;

type Props = PropsWithChildren<{
  index: number;
  itemCount: number;
  placeName: string;
  canMoveToPreviousDay: boolean;
  canMoveToNextDay: boolean;
  onMoveToDay: (direction: -1 | 1) => void;
  onRemove: () => void;
  onReorder: (targetIndex: number) => void;
}>;

export function DraggableItineraryItem({
  canMoveToNextDay,
  canMoveToPreviousDay,
  children,
  index,
  itemCount,
  onMoveToDay,
  onRemove,
  onReorder,
  placeName,
}: Props) {
  const [offset] = useState(() => new Animated.ValueXY());
  const [dragging] = useState(() => new Animated.Value(0));
  const finish = (dx: number, dy: number) => {
    if (Math.abs(dx) > HORIZONTAL_DAY_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && canMoveToNextDay) onMoveToDay(1);
      if (dx > 0 && canMoveToPreviousDay) onMoveToDay(-1);
    } else {
      onReorder(index + Math.round(dy / VERTICAL_DRAG_STEP));
    }
    Animated.parallel([
      Animated.spring(offset, { toValue: { x: 0, y: 0 }, useNativeDriver: true }),
      Animated.timing(dragging, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start();
  };
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      offset.setValue({ x: 0, y: 0 });
      dragging.setValue(1);
    },
    onPanResponderMove: Animated.event([null, { dx: offset.x, dy: offset.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => finish(gesture.dx, gesture.dy),
    onPanResponderTerminate: (_, gesture) => finish(gesture.dx, gesture.dy),
  // The responder must be recreated when the item's available drop targets change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [canMoveToNextDay, canMoveToPreviousDay, index, itemCount, onMoveToDay, onReorder, offset, dragging]);

  const accessibilityActions = [
    ...(index > 0 ? [{ name: "decrement" as const, label: "앞 순서로 이동" }] : []),
    ...(index < itemCount - 1 ? [{ name: "increment" as const, label: "뒤 순서로 이동" }] : []),
  ];

  return <Animated.View style={[styles.card, {
    opacity: dragging.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }),
    transform: [...offset.getTranslateTransform(), { scale: dragging.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }],
  }]}>
    <View style={styles.header}>
      <View
        accessibilityActions={accessibilityActions}
        accessibilityLabel={`${placeName} 순서 이동`}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 1, max: itemCount, now: index + 1 }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "decrement") onReorder(index - 1);
          if (event.nativeEvent.actionName === "increment") onReorder(index + 1);
        }}
        style={styles.dragHandle}
        {...panResponder.panHandlers}
      >
        <AppText variant="heading" color={colors.primary}>⠇</AppText>
      </View>
      <View style={styles.order}><AppText variant="caption" color={colors.white}>{index + 1}</AppText></View>
      <AppText variant="label" style={styles.name}>{placeName}</AppText>
      <Pressable accessibilityLabel={`${placeName} 일정에서 제외`} hitSlop={8} onPress={onRemove} style={styles.remove}>
        <AppText variant="heading" color={colors.muted}>×</AppText>
      </Pressable>
    </View>
    {children}
  </Animated.View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  header: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingRight: spacing.lg },
  dragHandle: { width: 32, minHeight: 40, alignItems: "center", justifyContent: "center" },
  order: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  name: { flex: 1 },
  remove: { position: "absolute", right: -4, top: -5, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
