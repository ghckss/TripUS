import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { mockPlaces } from "@/domains/places";

type Review = { rating?: number; unvisited?: boolean };
export default function CompleteTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const setRating = (id: string, rating: number) => setReviews((current) => ({ ...current, [id]: { rating } }));
  const toggleUnvisited = (id: string) => setReviews((current) => ({ ...current, [id]: { unvisited: !current[id]?.unvisited } }));
  return (
    <Screen>
      <AppText variant="title">다녀온 장소를 정리해요</AppText><AppText color={colors.muted}>탭을 고르지 않아도 돼요. 방문 장소는 별점을 주고, 가지 못한 곳만 미방문으로 표시하세요.</AppText>
      {mockPlaces.map((place) => { const review = reviews[place.id]; return <Card key={place.id}><View style={styles.row}><AppText variant="heading">{place.name}</AppText>{review?.unvisited && <Pill label="미방문" selected />}</View><View style={styles.stars}>{[1, 2, 3, 4, 5].map((rating) => <Pressable key={rating} disabled={review?.unvisited} accessibilityLabel={`${rating}점`} onPress={() => setRating(place.id, rating)}><AppText variant="title" color={!review?.unvisited && (review?.rating ?? 0) >= rating ? colors.primary : colors.line}>★</AppText></Pressable>)}</View><Button label={review?.unvisited ? "미방문 취소" : "미방문으로 설정"} variant="ghost" onPress={() => toggleUnvisited(place.id)} />{!review?.rating && !review?.unvisited && <AppText variant="caption" color={colors.muted}>별점 없이 정리하면 미평가로 보관돼요.</AppText>}</Card>; })}
      <Button label="정리하고 여행 보관" onPress={() => router.replace(`/trips/${tripId}/summary`)} />
      <Button label="정리 없이 보관" variant="ghost" onPress={() => router.replace(`/trips/${tripId}/summary`)} />
    </Screen>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, stars: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm } });
