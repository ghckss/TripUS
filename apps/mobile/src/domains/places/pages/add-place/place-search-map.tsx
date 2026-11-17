import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng } from "react-native-maps";

import type { PlaceSearchBounds, PlaceSearchCandidate } from "../../api/places.api";
import { colors, radius } from "@/shared/design/tokens";

export function PlaceSearchMap({ origin, results, selectedId, onSelect, onBoundsChange }: {
  origin: LatLng | null;
  results: PlaceSearchCandidate[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onBoundsChange: (bounds: PlaceSearchBounds) => void;
}) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);
  useEffect(() => {
    if (origin || !ready || fitted.current) return;
    const coordinates = results.flatMap((place) => place.latitude != null && place.longitude != null
      ? [{ latitude: place.latitude, longitude: place.longitude }] : []);
    if (!coordinates.length) return;
    fitted.current = true;
    if (coordinates.length === 1) map.current?.animateToRegion({ ...coordinates[0], latitudeDelta: 0.04, longitudeDelta: 0.04 });
    else map.current?.fitToCoordinates(coordinates, { edgePadding: { top: 40, bottom: 40, left: 40, right: 40 }, animated: true });
  }, [origin, ready, results]);
  const updateBounds = async () => {
    try {
      const viewport = await map.current?.getMapBoundaries();
      if (!viewport) return;
      const next = { north: viewport.northEast.latitude, south: viewport.southWest.latitude,
        east: viewport.northEast.longitude, west: viewport.southWest.longitude };
      if (next.north > next.south && next.east !== next.west) onBoundsChange(next);
    } catch { /* The next completed map gesture will retry reading the viewport. */ }
  };
  return <View style={styles.container}>
    <MapView ref={map} provider={PROVIDER_GOOGLE} testID="add-place-map"
      style={StyleSheet.absoluteFill}
      initialRegion={origin ? { ...origin, latitudeDelta: 0.08, longitudeDelta: 0.08 }
        : { latitude: 0, longitude: 0, latitudeDelta: 140, longitudeDelta: 360 }}
      onMapReady={() => { setReady(true); if (origin) void updateBounds(); }}
      onRegionChangeComplete={() => { void updateBounds(); }}
      pitchEnabled={false} rotateEnabled={false} toolbarEnabled={false} showsMyLocationButton={false}>
      {results.map((place) => place.latitude != null && place.longitude != null && <Marker
        key={place.googlePlaceId} identifier={place.googlePlaceId}
        testID={`add-place-marker-${place.googlePlaceId}`}
        coordinate={{ latitude: place.latitude, longitude: place.longitude }}
        title={place.name} description={place.address ?? undefined}
        pinColor={selectedId === place.googlePlaceId ? colors.primary : colors.secondary}
        onPress={() => onSelect(place.googlePlaceId)} />)}
    </MapView>
  </View>;
}
const styles = StyleSheet.create({
  container: { height: 260, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.secondarySoft },
});
