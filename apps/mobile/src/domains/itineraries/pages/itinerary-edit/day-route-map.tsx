import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng } from "react-native-maps";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import type { ItineraryItem } from "../../api/itineraries.api";

const MAP_HEIGHT = 240;

type LocatedItem = {
  item: ItineraryItem;
  order: number;
  coordinate: LatLng;
};

export function DayRouteMap({ items }: { items: ItineraryItem[] }) {
  const locatedItems = useMemo<LocatedItem[]>(() => items.flatMap((item, index) =>
    item.latitude == null || item.longitude == null
      ? []
      : [{ item, order: index + 1, coordinate: { latitude: item.latitude, longitude: item.longitude } }]), [items]);
  const coordinates = useMemo(() => locatedItems.map((entry) => entry.coordinate), [locatedItems]);
  const signature = locatedItems.map((entry) => `${entry.item.id}:${entry.coordinate.latitude}:${entry.coordinate.longitude}`).join("|");
  const firstCoordinate = coordinates[0] ?? { latitude: 37.5665, longitude: 126.978 };
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [movingCoordinate, setMovingCoordinate] = useState<LatLng>(firstCoordinate);

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
    if (coordinates.length === 0) return;
    if (coordinates.length < 2) return;
    let fromIndex = 0;
    let startedAt = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - startedAt) / 1200, 1);
      const from = coordinates[fromIndex];
      const to = coordinates[(fromIndex + 1) % coordinates.length];
      setMovingCoordinate({
        latitude: from.latitude + (to.latitude - from.latitude) * progress,
        longitude: from.longitude + (to.longitude - from.longitude) * progress,
      });
      if (progress === 1) {
        fromIndex = (fromIndex + 1) % coordinates.length;
        startedAt = Date.now();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [coordinates, signature]);

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
    >
      {coordinates.length > 1 && <Polyline coordinates={coordinates} geodesic strokeColor={colors.primary} strokeWidth={4} />}
      {locatedItems.map(({ coordinate, item, order }) => <Marker
        coordinate={coordinate}
        description={item.address ?? undefined}
        identifier={item.id}
        key={item.id}
        title={`${order}. ${item.placeName}`}
        zIndex={order}
      >
        <View style={styles.pin}><AppText variant="caption" color={colors.white}>{order}</AppText></View>
      </Marker>)}
      {coordinates.length > 1 && <Marker coordinate={movingCoordinate} pinColor={colors.secondary} zIndex={items.length + 1} />}
    </MapView>
    {locatedItems.length < items.length && <View style={styles.locationNotice}>
      <AppText variant="caption" color={colors.warning}>{items.length - locatedItems.length}개 장소의 위치를 확인 중이에요.</AppText>
    </View>}
    <View style={styles.legend}>
      <AppText variant="caption" color={colors.muted}>실제 위치 기반 방문 동선</AppText>
    </View>
  </View>;
}

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
  legend: { position: "absolute", left: spacing.sm, bottom: spacing.sm, borderRadius: radius.pill, backgroundColor: "#FFFFFFEE", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  locationNotice: { position: "absolute", top: spacing.sm, left: spacing.sm, right: spacing.sm, borderRadius: radius.sm, backgroundColor: "#FFF7E8EE", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
