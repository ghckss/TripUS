import { memo, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { AnimatedRegion, Marker, Polyline, PROVIDER_GOOGLE, type LatLng } from "react-native-maps";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import type { ItineraryItem } from "../../api/itineraries.api";

const MAP_HEIGHT = 240;
const ANIMATED_COORDINATE_DELTA = { latitudeDelta: 0, longitudeDelta: 0 };
const MovingMarker = Marker.Animated as unknown as ComponentType<{
  coordinate: AnimatedRegion;
  pinColor?: string;
  testID?: string;
  zIndex?: number;
}>;

type LocatedItem = {
  item: ItineraryItem;
  order: number;
  coordinate: LatLng;
};

type MarkerGroup = {
  coordinate: LatLng;
  entries: LocatedItem[];
};

const coordinateKey = ({ latitude, longitude }: LatLng) => `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
const markerGroupId = (entries: LocatedItem[]) => entries.map(({ item }) => item.id).join("-");
const markerOrderLabel = (entries: LocatedItem[]) => entries.map(({ order }) => order).join(" · ");

type MapFocusTarget = {
  itemId: string;
  request: number;
};

type DayRouteMapProps = {
  animationPaused?: boolean;
  focusTarget?: MapFocusTarget;
  items: ItineraryItem[];
};

export const DayRouteMap = memo(function DayRouteMap({ animationPaused = false, focusTarget, items }: DayRouteMapProps) {
  const locatedItems = useMemo<LocatedItem[]>(() => items.flatMap((item, index) =>
    item.latitude == null || item.longitude == null
      ? []
      : [{ item, order: index + 1, coordinate: { latitude: item.latitude, longitude: item.longitude } }]), [items]);
  const coordinates = useMemo(() => locatedItems.map((entry) => entry.coordinate), [locatedItems]);
  const markerGroups = useMemo<MarkerGroup[]>(() => {
    const groups = new Map<string, MarkerGroup>();
    locatedItems.forEach((entry) => {
      const key = coordinateKey(entry.coordinate);
      const group = groups.get(key);
      if (group) group.entries.push(entry);
      else groups.set(key, { coordinate: entry.coordinate, entries: [entry] });
    });
    return [...groups.values()];
  }, [locatedItems]);
  const signature = locatedItems.map((entry) => `${entry.item.id}:${entry.coordinate.latitude}:${entry.coordinate.longitude}`).join("|");
  const firstCoordinate = coordinates[0] ?? { latitude: 37.5665, longitude: 126.978 };
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [movingCoordinate] = useState(() => new AnimatedRegion({ ...firstCoordinate, ...ANIMATED_COORDINATE_DELTA }));
  const [movingMarkerVisible, setMovingMarkerVisible] = useState(coordinates.length > 1);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>();
  const [dismissedFocusRequest, setDismissedFocusRequest] = useState<number>();
  const focusedEntry = locatedItems.find(({ item }) => item.id === focusTarget?.itemId);
  const focusedGroupEntries = focusedEntry
    ? markerGroups.find(({ coordinate }) => coordinateKey(coordinate) === coordinateKey(focusedEntry.coordinate))?.entries
    : undefined;
  const focusRequest = focusTarget?.request;
  const focusLatitude = focusedEntry?.coordinate.latitude;
  const focusLongitude = focusedEntry?.coordinate.longitude;
  const focusGroupId = focusedGroupEntries ? markerGroupId(focusedGroupEntries) : undefined;
  const visibleMarkerId = focusGroupId && focusRequest !== dismissedFocusRequest ? focusGroupId : selectedMarkerId;
  const selectedMarkerGroup = markerGroups.find(({ entries }) => markerGroupId(entries) === visibleMarkerId);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || coordinates.length === 0) return;
    if (coordinates.length === 1) {
      map.animateToRegion({ ...coordinates[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 350);
      return;
    }
    map.fitToCoordinates(coordinates, {
      animated: true,
      edgePadding: { top: 44, right: 44, bottom: 44, left: 44 },
    });
  }, [coordinates, mapReady, signature]);

  useEffect(() => {
    if (!mapReady || focusRequest == null || focusLatitude == null || focusLongitude == null) return;
    mapRef.current?.animateToRegion({
      latitude: focusLatitude,
      longitude: focusLongitude,
      latitudeDelta: 0.006,
      longitudeDelta: 0.006,
    }, 450);
  }, [focusLatitude, focusLongitude, focusRequest, mapReady]);

  useEffect(() => {
    movingCoordinate.stopAnimation(() => undefined);
    if (coordinates.length < 2 || animationPaused) return;

    let cancelled = false;
    let kickoffTimer: ReturnType<typeof setTimeout> | undefined;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let activeAnimation: ReturnType<AnimatedRegion["timing"]> | undefined;

    const animateSegment = (fromIndex: number) => {
      if (cancelled) return;
      const destination = coordinates[fromIndex + 1];
      activeAnimation = movingCoordinate.timing({
        latitude: destination.latitude,
        longitude: destination.longitude,
        ...ANIMATED_COORDINATE_DELTA,
        duration: 1200,
        // React Native 0.88's timing type requires this even though
        // AnimatedRegion replaces it for each coordinate internally.
        toValue: 0,
        useNativeDriver: false,
      });
      activeAnimation.start(({ finished }) => {
        if (cancelled || !finished) return;
        if (fromIndex < coordinates.length - 2) {
          animateSegment(fromIndex + 1);
          return;
        }
        setMovingMarkerVisible(false);
        restartTimer = setTimeout(() => {
          if (cancelled) return;
          movingCoordinate.setValue({ ...coordinates[0], ...ANIMATED_COORDINATE_DELTA });
          setMovingMarkerVisible(true);
          animateSegment(0);
        }, 400);
      });
    };

    movingCoordinate.setValue({ ...coordinates[0], ...ANIMATED_COORDINATE_DELTA });
    kickoffTimer = setTimeout(() => {
      if (cancelled) return;
      setMovingMarkerVisible(true);
      animateSegment(0);
    }, 0);

    return () => {
      cancelled = true;
      activeAnimation?.stop();
      movingCoordinate.stopAnimation(() => undefined);
      if (kickoffTimer) clearTimeout(kickoffTimer);
      if (restartTimer) clearTimeout(restartTimer);
    };
  }, [animationPaused, coordinates, movingCoordinate, signature]);

  if (items.length === 0) return <MapEmptyState title="오늘의 동선이 비어 있어요" description="장소를 추가하면 실제 위치를 지도에 보여줄게요." />;
  if (locatedItems.length === 0) return <MapEmptyState title="장소 위치를 확인하고 있어요" description="Google Places 위치 정보가 확인되면 실제 지도 동선이 표시돼요." />;

  return <View accessibilityLabel={`오늘의 Google 지도 동선, ${locatedItems.length}개 장소`} style={styles.container}>
    <MapView
      initialRegion={{ ...firstCoordinate, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      mapType="standard"
      onMapReady={() => setMapReady(true)}
      pitchEnabled={false}
      provider={PROVIDER_GOOGLE}
      ref={mapRef}
      rotateEnabled={false}
      showsCompass={false}
      showsMyLocationButton={false}
      style={StyleSheet.absoluteFill}
      toolbarEnabled={false}
      testID="day-route-map"
    >
      {coordinates.length > 1 && <Polyline coordinates={coordinates} geodesic strokeColor={colors.primary} strokeWidth={4} />}
      {markerGroups.map(({ coordinate, entries }) => {
        const orderLabel = markerOrderLabel(entries);
        const markerId = markerGroupId(entries);
        return <Marker
          accessibilityLabel={`${orderLabel}번 일정, ${entries.map(({ item }) => item.placeName).join(", ")}`}
          coordinate={coordinate}
          identifier={markerId}
          key={markerId}
          onPress={() => {
            setSelectedMarkerId(markerId);
            if (focusRequest != null) setDismissedFocusRequest(focusRequest);
          }}
          testID={`route-marker-${entries.map(({ order }) => order).join("-")}`}
          zIndex={Math.max(...entries.map(({ order }) => order))}
        >
          <View style={[styles.pin, entries.length > 1 && styles.combinedPin]}>
            <AppText variant="caption" color={colors.white}>{orderLabel}</AppText>
          </View>
        </Marker>;
      })}
      {coordinates.length > 1 && !animationPaused && movingMarkerVisible && <MovingMarker coordinate={movingCoordinate} pinColor={colors.secondary} testID="route-moving-marker" zIndex={0} />}
    </MapView>
    {selectedMarkerGroup && <View accessibilityLabel={`${markerOrderLabel(selectedMarkerGroup.entries)}번 일정 상세`} style={styles.markerDetails}>
      <Pressable accessibilityLabel="일정 상세 닫기" hitSlop={8} onPress={() => {
        setSelectedMarkerId(undefined);
        if (focusRequest != null) setDismissedFocusRequest(focusRequest);
      }} style={styles.detailsClose}>
        <AppText color={colors.muted}>×</AppText>
      </Pressable>
      {selectedMarkerGroup.entries.map(({ item, order }) => <View key={item.id} style={styles.detailsRow}>
        <AppText variant="label" color={colors.primary}>{order}</AppText>
        <View style={styles.detailsContent}>
          <AppText variant="label">{item.placeName}</AppText>
          {item.address && <AppText variant="caption" color={colors.muted} numberOfLines={1}>{item.address}</AppText>}
        </View>
      </View>)}
    </View>}
    {locatedItems.length < items.length && <View style={styles.locationNotice}>
      <AppText variant="caption" color={colors.warning}>{items.length - locatedItems.length}개 장소의 위치를 확인 중이에요.</AppText>
    </View>}
    <View style={styles.legend}>
      <AppText variant="caption" color={colors.muted}>실제 위치 기반 방문 동선</AppText>
    </View>
  </View>;
});

function MapEmptyState({ title, description }: { title: string; description: string }) {
  return <View style={[styles.container, styles.empty]}>
    <AppText variant="label">{title}</AppText>
    <AppText variant="caption" color={colors.muted} style={styles.emptyDescription}>{description}</AppText>
  </View>;
}

const styles = StyleSheet.create({
  container: { height: MAP_HEIGHT, overflow: "hidden", borderRadius: radius.md, backgroundColor: "#EEF0EA", borderWidth: 1, borderColor: colors.line },
  empty: { alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.lg },
  emptyDescription: { textAlign: "center" },
  pin: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.22, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  combinedPin: { width: "auto", minWidth: 48, paddingHorizontal: spacing.sm },
  markerDetails: { position: "absolute", zIndex: 2, top: spacing.sm, left: spacing.sm, right: spacing.sm, gap: spacing.xs, borderRadius: radius.sm, backgroundColor: "#FFFFFFF5", padding: spacing.sm, paddingRight: spacing.xl, shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  detailsClose: { position: "absolute", zIndex: 1, top: spacing.xs, right: spacing.sm },
  detailsRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  detailsContent: { flex: 1, gap: 2 },
  legend: { position: "absolute", left: spacing.sm, bottom: spacing.sm, borderRadius: radius.pill, backgroundColor: "#FFFFFFEE", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  locationNotice: { position: "absolute", top: spacing.sm, left: spacing.sm, right: spacing.sm, borderRadius: radius.sm, backgroundColor: "#FFF7E8EE", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
