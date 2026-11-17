import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useAppDialog } from "@/shared/ui/app-dialog";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { EditorialHeading } from "@/shared/ui/field-notes";
import { TripNavigation } from "@/shared/ui/trip-navigation";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing, fonts } from "@/shared/design/tokens";
import { isItineraryBoundary, type ItineraryItem } from "@/domains/itineraries";
import { tripUsApiBaseUrl } from "@/shared/api/trip-us-api";
import { useCompleteTrip } from "./use-complete-trip";

type Review = { rating?: number; unvisited?: boolean; review?: string };

function groupPlaces(items: ItineraryItem[]): ItineraryItem[][] {
  const groups = new Map<string, ItineraryItem[]>();
  items.forEach((item) => {
    if (isItineraryBoundary(item)) return;
    const group = groups.get(item.savedPlaceId);
    if (group) group.push(item);
    else groups.set(item.savedPlaceId, [item]);
  });
  return [...groups.values()];
}

export default function CompleteTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { showDialog } = useAppDialog();
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const { accessToken, addPhoto, complete, error, itinerary, photos, retry, saving, trip, uploadingItemId } = useCompleteTrip(tripId);
  const allowNavigation = useUnsavedChanges(Object.keys(reviews).length > 0, saving || Boolean(uploadingItemId));
  const placeGroups = useMemo(() => groupPlaces(itinerary?.items ?? []), [itinerary]);
  const completed = Boolean(trip?.archivedAt) || Boolean(itinerary?.items.some((item) => item.visitStatus));
  const savedReviews = useMemo(() => Object.fromEntries(placeGroups.map((group) => {
    const recorded = group.find((item) => item.visitStatus === "rated") ?? group[0];
    return [recorded.savedPlaceId, {
      rating: typeof recorded.rating === "number" ? recorded.rating : undefined,
      unvisited: recorded.visitStatus === "not_visited",
      review: recorded.visitStatus === "not_visited" ? undefined : recorded.review ?? undefined,
    } satisfies Review];
  })), [placeGroups]);
  const currentReview = (id: string) => reviews[id] ?? savedReviews[id];
  const setRating = (id: string, rating: number) => setReviews((current) => ({ ...current, [id]: { ...savedReviews[id], ...current[id], rating, unvisited: false } }));
  const toggleUnvisited = (id: string) => setReviews((current) => {
    const review = current[id] ?? savedReviews[id];
    const unvisited = !review?.unvisited;
    return { ...current, [id]: { ...review, rating: undefined, review: unvisited ? undefined : review?.review, unvisited } };
  });
  const setReview = (id: string, review: string) => setReviews((current) => ({ ...current, [id]: { ...savedReviews[id], ...current[id], review } }));
  const submitReviews = () => {
    const items = placeGroups.flatMap((group) => {
      const evaluation = currentReview(group[0].savedPlaceId) ?? {};
      return group.map(({ id: itineraryItemId }) => ({
        itineraryItemId,
        rating: evaluation.rating,
        notVisited: evaluation.unvisited ?? false,
        review: evaluation.review,
      }));
    });
    void complete(items).then((done) => { if (done) { allowNavigation(); router.dismissTo(`/trips/${tripId}/summary`); } });
  };
  return (
    <Screen bottomSlot={<TripNavigation tripId={tripId} active="record" onNavigate={(navigate) => {
      if (Object.keys(reviews).length === 0) { navigate(); return; }
      showDialog({ title: "작성 중인 기록이 있어요", message: "이동하면 아직 저장하지 않은 별점과 메모가 사라져요.", actions: [
        { label: "계속 작성", variant: "ghost" },
        { label: "저장하지 않고 이동", variant: "ghost", onPress: () => { allowNavigation(); navigate(); } },
      ] });
    }} />}>
      <EditorialHeading eyebrow="KEEP A MOMENT" title={completed ? "여행의 기억을 다듬어요." : "어떤 순간이\n가장 오래 남았나요?"} /><AppText color={colors.muted}>{completed ? "완료한 여행도 사진, 별점과 후기를 언제든 다시 추가하거나 수정할 수 있어요." : "탭을 고르지 않아도 돼요. 방문 장소는 별점을 주고, 가지 못한 곳만 미방문으로 표시하세요."}</AppText>
      {error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void retry()} /></Card>}
      {!itinerary && !error && <Card><AppText color={colors.muted}>방문 장소를 불러오는 중이에요…</AppText></Card>}
      {placeGroups.map((group) => {
        const place = group[0];
        const review = currentReview(place.savedPlaceId);
        const itemIds = new Set(group.map(({ id }) => id));
        const photo = photos.find((candidate) => candidate.itineraryItemId && itemIds.has(candidate.itineraryItemId));
        const photoUri = photo?.thumbnailUrl ?? photo?.optimizedUrl ?? photo?.originalUrl;
        const photoSource = photoUri
          ? photoUri.startsWith(tripUsApiBaseUrl) && accessToken
            ? { uri: photoUri, headers: { Authorization: `Bearer ${accessToken}` } }
            : { uri: photoUri }
          : undefined;
        const uploading = uploadingItemId ? itemIds.has(uploadingItemId) : false;
        return <Card key={place.savedPlaceId}>
          <View style={styles.row}><AppText variant="heading" style={styles.placeName}>{place.placeName}</AppText>{review?.unvisited && <View style={styles.unvisitedChip}><Pill label="미방문" selected /></View>}</View>
          {!review?.unvisited && <>
            {photoSource && <Image source={photoSource} style={styles.placePhoto} contentFit="cover" accessibilityLabel={`${place.placeName} 대표 사진`} />}
            <View accessibilityRole="radiogroup" accessibilityLabel={`${place.placeName} 나의 별점`} style={styles.stars}>{[1, 2, 3, 4, 5].map((rating) => <Pressable key={rating} accessibilityRole="radio" accessibilityState={{ checked: review?.rating === rating }} style={styles.starTouch} accessibilityLabel={`${rating}점`} testID={`complete-rating-${place.id}-${rating}`} onPress={() => setRating(place.savedPlaceId, rating)}><AppText style={styles.starGlyph} color={(review?.rating ?? 0) >= rating ? colors.primary : colors.muted}>{(review?.rating ?? 0) >= rating ? "★" : "☆"}</AppText></Pressable>)}</View>
            <TextInput value={review?.review ?? ""} onChangeText={(value) => setReview(place.savedPlaceId, value)} multiline placeholder="이 장소의 기억을 남겨 보세요" placeholderTextColor={colors.muted} style={styles.input} />
            <Button label={uploading ? "사진 처리 중…" : photo ? "사진 등록 완료" : "사진 추가"} disabled={Boolean(uploadingItemId) || Boolean(photo)} variant="secondary" onPress={() => void addPhoto(place.id)} />
          </>}
          <Button label={review?.unvisited ? "미방문 취소" : "미방문으로 설정"} disabled={Boolean(uploadingItemId)} variant="ghost" onPress={() => toggleUnvisited(place.savedPlaceId)} />
          {!review?.rating && !review?.unvisited && <AppText variant="caption" color={colors.muted}>별점 없이 정리하면 미평가로 보관돼요.</AppText>}
        </Card>;
      })}
      <Button label={saving ? "저장 중…" : completed ? "여행 기록 저장" : "정리하고 여행 보관"} disabled={!itinerary || saving || Boolean(uploadingItemId)} testID="complete-trip-submit" onPress={submitReviews} />
      {!completed && <Button label="정리 없이 보관" variant="ghost" disabled={!itinerary || saving} testID="complete-trip-without-review" onPress={() => void complete([]).then((done) => { if (done) { allowNavigation(); router.dismissTo(`/trips/${tripId}/summary`); } })} />}
    </Screen>
  );
}
const styles = StyleSheet.create({ placePhoto: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.sm, backgroundColor: colors.secondarySoft }, starTouch: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, starGlyph: { fontSize: 30, lineHeight: 40 }, row: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, placeName: { flex: 1, flexShrink: 1 }, unvisitedChip: { flexShrink: 0 }, stars: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm }, input: { fontFamily: fonts.sans, minHeight: 88, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.md, color: colors.ink, backgroundColor: colors.surface, textAlignVertical: "top" } });
