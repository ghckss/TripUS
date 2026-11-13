import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing } from "@/shared/design/tokens";
import type { ItineraryItem } from "@/domains/itineraries";
import { useCompleteTrip } from "./use-complete-trip";

type Review = { rating?: number; unvisited?: boolean; review?: string };

function groupPlaces(items: ItineraryItem[]): ItineraryItem[][] {
  const groups = new Map<string, ItineraryItem[]>();
  items.forEach((item) => {
    const group = groups.get(item.savedPlaceId);
    if (group) group.push(item);
    else groups.set(item.savedPlaceId, [item]);
  });
  return [...groups.values()];
}

export default function CompleteTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const { addPhoto, complete, error, itinerary, photos, reload, saving, uploadingItemId } = useCompleteTrip(tripId);
  const placeGroups = groupPlaces(itinerary?.items ?? []);
  const setRating = (id: string, rating: number) => setReviews((current) => ({ ...current, [id]: { ...current[id], rating, unvisited: false } }));
  const toggleUnvisited = (id: string) => setReviews((current) => {
    const unvisited = !current[id]?.unvisited;
    return { ...current, [id]: { ...current[id], rating: undefined, review: unvisited ? undefined : current[id]?.review, unvisited } };
  });
  const setReview = (id: string, review: string) => setReviews((current) => ({ ...current, [id]: { ...current[id], review } }));
  const submitReviews = () => {
    const items = placeGroups.flatMap((group) => {
      const evaluation = reviews[group[0].savedPlaceId];
      if (!evaluation) return [];
      return group.map(({ id: itineraryItemId }) => ({
        itineraryItemId,
        rating: evaluation.rating,
        notVisited: evaluation.unvisited ?? false,
        review: evaluation.review,
      }));
    });
    void complete(items).then((done) => { if (done) router.replace(`/trips/${tripId}/summary`); });
  };
  return (
    <Screen>
      <AppText variant="title">다녀온 장소를 정리해요</AppText><AppText color={colors.muted}>탭을 고르지 않아도 돼요. 방문 장소는 별점을 주고, 가지 못한 곳만 미방문으로 표시하세요.</AppText>
      {error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
      {!itinerary && !error && <Card><AppText color={colors.muted}>방문 장소를 불러오는 중이에요…</AppText></Card>}
      {placeGroups.map((group) => {
        const place = group[0];
        const review = reviews[place.savedPlaceId];
        const itemIds = new Set(group.map(({ id }) => id));
        const photoCount = photos.filter((photo) => photo.itineraryItemId && itemIds.has(photo.itineraryItemId)).length;
        const uploading = uploadingItemId ? itemIds.has(uploadingItemId) : false;
        return <Card key={place.savedPlaceId}>
          <View style={styles.row}><AppText variant="heading" style={styles.placeName}>{place.placeName}</AppText>{review?.unvisited && <View style={styles.unvisitedChip}><Pill label="미방문" selected /></View>}</View>
          {!review?.unvisited && <>
            <View style={styles.stars}>{[1, 2, 3, 4, 5].map((rating) => <Pressable key={rating} accessibilityLabel={`${rating}점`} testID={`complete-rating-${place.id}-${rating}`} onPress={() => setRating(place.savedPlaceId, rating)}><AppText variant="title" color={(review?.rating ?? 0) >= rating ? colors.primary : colors.line}>★</AppText></Pressable>)}</View>
            <TextInput value={review?.review ?? ""} onChangeText={(value) => setReview(place.savedPlaceId, value)} multiline placeholder="이 장소의 기억을 남겨 보세요" placeholderTextColor={colors.muted} style={styles.input} />
            <Button label={uploading ? "사진 처리 중…" : `사진 추가${photoCount ? ` · ${photoCount}장` : ""}`} disabled={Boolean(uploadingItemId)} variant="secondary" onPress={() => void addPhoto(place.id)} />
          </>}
          <Button label={review?.unvisited ? "미방문 취소" : "미방문으로 설정"} disabled={Boolean(uploadingItemId)} variant="ghost" onPress={() => toggleUnvisited(place.savedPlaceId)} />
          {!review?.rating && !review?.unvisited && <AppText variant="caption" color={colors.muted}>별점 없이 정리하면 미평가로 보관돼요.</AppText>}
        </Card>;
      })}
      <Button label={saving ? "보관 중…" : "정리하고 여행 보관"} disabled={!itinerary || saving || Boolean(uploadingItemId)} testID="complete-trip-submit" onPress={submitReviews} />
      <Button label="정리 없이 보관" variant="ghost" disabled={!itinerary || saving} testID="complete-trip-without-review" onPress={() => void complete([]).then((done) => { if (done) router.replace(`/trips/${tripId}/summary`); })} />
    </Screen>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, placeName: { flex: 1, flexShrink: 1 }, unvisitedChip: { flexShrink: 0 }, stars: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm }, input: { minHeight: 88, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.md, color: colors.ink, textAlignVertical: "top" } });
