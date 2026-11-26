import { useEffect, useMemo, useState, type ComponentType } from "react";
import MapView, { AnimatedRegion, Marker, Polyline } from "react-native-maps";
import { StyleSheet, View } from "react-native";

import type { ItineraryItem } from "@/domains/itineraries";
import type { Trip } from "@/domains/trips";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";

type Coordinate = { latitude: number; longitude: number };
const coordinateDelta = { latitudeDelta: 0, longitudeDelta: 0 };
const ReplayMarker = Marker.Animated as unknown as ComponentType<{
  coordinate: AnimatedRegion;
  pinColor?: string;
  testID?: string;
  zIndex?: number;
}>;

function hasCoordinate(item: ItineraryItem): item is ItineraryItem & Coordinate {
  return typeof item.latitude === "number" && typeof item.longitude === "number";
}

export function visitedHistoryItems(items: ItineraryItem[]): ItineraryItem[] {
  return items
    .filter((item) => !item.boundaryType && item.visitStatus !== "not_visited")
    .sort((left, right) => (left.date ?? "").localeCompare(right.date ?? "") || (left.position ?? 0) - (right.position ?? 0));
}

export function straightLineDistanceKm(items: ItineraryItem[]): number {
  const byDate = new Map<string, (ItineraryItem & Coordinate)[]>();
  for (const item of visitedHistoryItems(items)) {
    if (!item.date || !hasCoordinate(item)) continue;
    const group = byDate.get(item.date) ?? [];
    group.push(item);
    byDate.set(item.date, group);
  }
  let meters = 0;
  for (const day of byDate.values()) {
    for (let index = 1; index < day.length; index += 1) meters += haversineMeters(day[index - 1], day[index]);
  }
  return meters / 1000;
}

export function regionVisitCounts(trip: Trip, items: ItineraryItem[]): { name: string; count: number }[] {
  const regions = trip.regions ?? [];
  if (regions.length === 0) return [];
  const counts = new Map(regions.map((region) => [region.name, 0]));
  for (const item of visitedHistoryItems(items)) {
    const text = `${item.placeName} ${item.address ?? ""}`.toLocaleLowerCase();
    let region = regions.find((candidate) => text.includes(candidate.name.toLocaleLowerCase()));
    if (!region && hasCoordinate(item)) {
      region = regions
        .filter((candidate): candidate is typeof candidate & Coordinate => typeof candidate.latitude === "number" && typeof candidate.longitude === "number")
        .sort((left, right) => haversineMeters(item, left) - haversineMeters(item, right))[0];
    }
    if (!region && regions.length === 1) region = regions[0];
    if (region) counts.set(region.name, (counts.get(region.name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).filter(({ count }) => count > 0);
}

export function TripHistoryInsights({ trip, items }: { trip: Trip; items: ItineraryItem[] }) {
  const visited = useMemo(() => visitedHistoryItems(items), [items]);
  const coordinates = useMemo(() => visited.filter(hasCoordinate), [visited]);
  const routeDays = useMemo(() => {
    const groups = new Map<string, (ItineraryItem & Coordinate)[]>();
    for (const item of coordinates) {
      if (!item.date) continue;
      const day = groups.get(item.date) ?? [];
      day.push(item);
      groups.set(item.date, day);
    }
    return [...groups.values()];
  }, [coordinates]);
  const regions = regionVisitCounts(trip, items);
  const distance = straightLineDistanceKm(items);
  const initial = coordinates[0];
  const [replaying, setReplaying] = useState(false);
  const [replayMarkerVisible, setReplayMarkerVisible] = useState(false);
  const [replayCoordinate] = useState(() => new AnimatedRegion({
    latitude: initial?.latitude ?? 37.5665,
    longitude: initial?.longitude ?? 126.978,
    ...coordinateDelta,
  }));
  const coordinateSignature = coordinates.map((item) => `${item.id}:${item.latitude}:${item.longitude}`).join("|");

  useEffect(() => {
    replayCoordinate.stopAnimation(() => undefined);
    if (!replaying || coordinates.length < 2) return;
    let cancelled = false;
    let activeAnimation: ReturnType<AnimatedRegion["timing"]> | undefined;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    const animateSegment = (index: number) => {
      if (cancelled) return;
      const destination = coordinates[index + 1];
      activeAnimation = replayCoordinate.timing({
        latitude: destination.latitude,
        longitude: destination.longitude,
        ...coordinateDelta,
        duration: 900,
        toValue: 0,
        useNativeDriver: false,
      });
      activeAnimation.start(({ finished }) => {
        if (cancelled || !finished) return;
        if (index < coordinates.length - 2) return animateSegment(index + 1);
        setReplayMarkerVisible(false);
        resetTimer = setTimeout(() => {
          if (cancelled) return;
          replayCoordinate.setValue({ ...coordinates[0], ...coordinateDelta });
          setReplaying(false);
        }, 350);
      });
    };

    replayCoordinate.setValue({ ...coordinates[0], ...coordinateDelta });
    animateSegment(0);
    return () => {
      cancelled = true;
      activeAnimation?.stop();
      replayCoordinate.stopAnimation(() => undefined);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [coordinateSignature, coordinates, replayCoordinate, replaying]);

  const startReplay = () => {
    replayCoordinate.setValue({ ...coordinates[0], ...coordinateDelta });
    setReplayMarkerVisible(true);
    setReplaying(true);
  };

  return <View style={styles.section}>
    <AppText variant="heading">여행 다시보기</AppText>
    {initial ? <View style={styles.mapFrame}>
      <MapView
        initialRegion={{ latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        style={styles.map}
        testID="trip-history-map"
        toolbarEnabled={false}
        zoomEnabled={false}
      >
        {coordinates.map((item, index) => <Marker key={item.id} coordinate={item} title={`${index + 1}. ${item.placeName}`} />)}
        {routeDays.map((day) => day.length > 1 && <Polyline key={day.map((item) => item.id).join("-")} coordinates={day} strokeColor={colors.primary} strokeWidth={3} />)}
        {replayMarkerVisible && <ReplayMarker coordinate={replayCoordinate} pinColor={colors.secondary} testID="trip-history-replay-marker" zIndex={0} />}
      </MapView>
      {coordinates.length > 1 && <Button label={replaying ? "방문 순서 재생 중…" : "방문 순서 재생"} variant="secondary" disabled={replaying} testID="trip-history-replay" onPress={startReplay} />}
      <AppText variant="caption" color={colors.muted}>실제 GPS 기록이 아니라 방문 순서를 직선으로 연결한 다시보기예요.</AppText>
    </View> : <Card><AppText color={colors.muted}>지도에 표시할 장소 위치가 없어요.</AppText></Card>}
    <View style={styles.stats}>
      <Card style={styles.statCard}><AppText variant="title">{visited.length}</AppText><AppText variant="caption" color={colors.muted}>방문 장소</AppText></Card>
      <Card style={styles.statCard}><AppText variant="title">{distance < 10 ? distance.toFixed(1) : Math.round(distance)}</AppText><AppText variant="caption" color={colors.muted}>직선 거리 km</AppText></Card>
    </View>
    {regions.length > 0 && <Card><AppText variant="label">지역별 방문</AppText>{regions.map((region) => <View key={region.name} style={styles.regionRow}><AppText>{region.name}</AppText><AppText color={colors.primary}>{region.count}곳</AppText></View>)}</Card>}
  </View>;
}

function haversineMeters(left: Coordinate, right: Coordinate): number {
  const radians = (value: number) => value * Math.PI / 180;
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  mapFrame: { gap: spacing.sm },
  map: { width: "100%", height: 260, borderRadius: radius.md },
  stats: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, alignItems: "center" },
  regionRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.sm },
});
