import { useEffect, useMemo, useState } from "react";
import { Animated, LayoutChangeEvent, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import type { ItineraryItem } from "../../api/itineraries.api";

const MAP_HEIGHT = 196;
const MAP_PADDING = 28;
const ROUTE_POINTS = [
  { x: 0.08, y: 0.72 },
  { x: 0.31, y: 0.28 },
  { x: 0.52, y: 0.62 },
  { x: 0.73, y: 0.22 },
  { x: 0.9, y: 0.56 },
  { x: 0.68, y: 0.78 },
  { x: 0.4, y: 0.48 },
  { x: 0.16, y: 0.2 },
];

type Point = { x: number; y: number };

function RouteLine({ from, to }: { from: Point; to: Point }) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return <View style={[styles.routeLine, {
    left: from.x,
    top: from.y,
    width: length,
    transform: [{ rotate: `${angle}rad` }],
  }]} />;
}

export function DayRouteMap({ items }: { items: ItineraryItem[] }) {
  const [width, setWidth] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const signature = items.map((item) => item.id).join(":");
  const points = useMemo(() => items.map((_, index) => {
    const source = ROUTE_POINTS[index % ROUTE_POINTS.length];
    return {
      x: MAP_PADDING + source.x * Math.max(0, width - MAP_PADDING * 2),
      y: MAP_PADDING + source.y * (MAP_HEIGHT - MAP_PADDING * 2),
    };
  }), [items, width]);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (points.length < 2) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, {
        toValue: points.length - 1,
        duration: Math.max(1800, (points.length - 1) * 1100),
        useNativeDriver: true,
      }),
      Animated.delay(700),
    ]));
    animation.start();
    return () => animation.stop();
  }, [points.length, progress, signature]);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const inputRange = points.map((_, index) => index);
  const translateX = points.length > 1
    ? progress.interpolate({ inputRange, outputRange: points.map((point) => point.x - 9) })
    : 0;
  const translateY = points.length > 1
    ? progress.interpolate({ inputRange, outputRange: points.map((point) => point.y - 9) })
    : 0;

  return <View accessibilityLabel={`오늘의 지도 동선, ${items.length}개 장소`} style={styles.container} onLayout={onLayout}>
    <View style={styles.water} />
    <View style={[styles.park, styles.parkTop]} />
    <View style={[styles.park, styles.parkBottom]} />
    <View style={[styles.road, styles.roadOne]} />
    <View style={[styles.road, styles.roadTwo]} />
    {points.slice(0, -1).map((point, index) => <RouteLine key={`${signature}-line-${index}`} from={point} to={points[index + 1]} />)}
    {points.map((point, index) => <View key={items[index].id} style={[styles.pin, { left: point.x - 14, top: point.y - 14 }]}>
      <AppText variant="caption" color={colors.white}>{index + 1}</AppText>
    </View>)}
    {points.length > 1 && <Animated.View style={[styles.movingPin, { transform: [{ translateX }, { translateY }] }]} />}
    {items.length === 0 && <View style={styles.empty}>
      <AppText variant="label">오늘의 동선이 비어 있어요</AppText>
      <AppText variant="caption" color={colors.muted}>장소를 추가하면 방문 순서를 지도에 보여줄게요.</AppText>
    </View>}
    {items.length > 0 && <View style={styles.legend}>
      <AppText variant="caption" color={colors.muted}>방문 순서 기반 동선 미리보기</AppText>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { height: MAP_HEIGHT, overflow: "hidden", borderRadius: radius.md, backgroundColor: "#EEF0EA", borderWidth: 1, borderColor: colors.line },
  water: { position: "absolute", right: -34, top: -12, width: 130, height: 250, borderRadius: 70, backgroundColor: "#DCECF1", transform: [{ rotate: "10deg" }] },
  park: { position: "absolute", backgroundColor: "#DDE9D7", borderRadius: radius.lg },
  parkTop: { left: -12, top: 14, width: 110, height: 48, transform: [{ rotate: "-8deg" }] },
  parkBottom: { left: 80, bottom: -18, width: 150, height: 62, transform: [{ rotate: "7deg" }] },
  road: { position: "absolute", height: 12, backgroundColor: "#FFFFFFB8", borderWidth: 1, borderColor: "#E7E3DB" },
  roadOne: { left: -30, top: 82, width: 430, transform: [{ rotate: "-13deg" }] },
  roadTwo: { left: 34, top: 38, width: 260, transform: [{ rotate: "62deg" }] },
  routeLine: { position: "absolute", height: 3, borderRadius: radius.pill, backgroundColor: colors.primary, transformOrigin: "left center", opacity: 0.72 },
  pin: { position: "absolute", width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  movingPin: { position: "absolute", left: 0, top: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, borderWidth: 5, borderColor: colors.secondary, shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.lg },
  legend: { position: "absolute", left: spacing.sm, bottom: spacing.sm, borderRadius: radius.pill, backgroundColor: "#FFFFFFE8", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
