import { useApiQuery } from "@/shared/query/use-resource";
import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { getTripCover, type Trip } from "../api/trips.api";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { FieldIllustration } from "@/shared/ui/field-notes";

const variants = [
  { kind: "journey", background: colors.secondarySoft },
  { kind: "cafe", background: colors.primarySoft },
  { kind: "park", background: colors.line },
  { kind: "journey", background: colors.primarySoft },
  { kind: "cafe", background: colors.canvas },
  { kind: "park", background: colors.secondarySoft },
] as const;

export function tripCoverVariant(id: string) {
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return variants[hash % variants.length];
}

export function TripCover({ trip }: { trip: Trip }) {
  const city = trip.regions?.[0];
  const identity = `${trip.id}:${city?.googlePlaceId ?? ""}:${city?.name ?? ""}`;
  const { data: photo } = useApiQuery(`trips:${trip.id}:cover`, getTripCover, trip.id);
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const [failedUrl, setFailedUrl] = useState<string>();
  const imageUrl = photo?.googleMapsUri && photo.imageUrl !== failedUrl ? photo.imageUrl : undefined;
  const loaded = Boolean(imageUrl && loadedUrl === imageUrl);
  const variant = tripCoverVariant(trip.id);

  return <View>
    <View style={[styles.frame, { backgroundColor: variant.background }]} testID={`trip-cover-${trip.id}`}>
      <FieldIllustration kind={variant.kind} style={styles.art} />
      {imageUrl && <Image testID={`trip-cover-photo-${trip.id}`} source={{ uri: imageUrl }}
        accessibilityLabel={`${city?.name ?? trip.destination} 여행 표지 사진`}
        contentFit="cover" cachePolicy="memory" recyclingKey={identity}
        style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
        onLoad={() => setLoadedUrl(imageUrl)} onError={() => setFailedUrl(imageUrl)} />}
      <View style={styles.label}>
        <AppText variant="label" color={colors.white} numberOfLines={1}>{city?.name ?? trip.destination}</AppText>
        <AppText variant="micro" color={`${colors.white}E6`}>{trip.startDate} — {trip.endDate}</AppText>
      </View>
    </View>

  </View>;
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden", borderRadius: radius.sm },
  art: { width: "100%", height: "100%", aspectRatio: undefined },
  label: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundImage: `linear-gradient(to bottom, ${colors.ink}00 0%, ${colors.ink}80 45%, ${colors.ink}D9 100%)`,
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.compact,
  },
});
