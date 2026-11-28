import { useCloseTripWorkspace } from "@/shared/ui/trip-workspace";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useCallback } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { TripNavigation } from "@/shared/ui/trip-navigation";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing, touch } from "@/shared/design/tokens";
import { useTripSummary } from "./use-trip-summary";
import { isItineraryBoundary, type ItineraryItem } from "@/domains/itineraries";
import { TripHistoryInsights } from "./trip-history-insights";
import { tripPhotoImageSource, type TripPhoto } from "../../api/photos.api";
import { TripCover } from "@/domains/trips/components/trip-cover";

type TripSummaryHero = { item: ItineraryItem; photo: TripPhoto; uri: string };

export function selectTripSummaryHero(items: ItineraryItem[], photos: TripPhoto[]): TripSummaryHero | undefined {
  const photoByItemId = new Map(photos.flatMap((photo) => {
    const uri = photo.optimizedUrl ?? photo.originalUrl ?? photo.thumbnailUrl;
    return photo.itineraryItemId && uri ? [[photo.itineraryItemId, { photo, uri }] as const] : [];
  }));
  const candidates = items.flatMap((item) => {
    const linked = item.visitStatus !== "not_visited" ? photoByItemId.get(item.id) : undefined;
    return linked ? [{ item, ...linked }] : [];
  });
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, candidate) => {
    const bestRating = typeof best.item.rating === "number" ? best.item.rating : -1;
    const candidateRating = typeof candidate.item.rating === "number" ? candidate.item.rating : -1;
    return candidateRating > bestRating ? candidate : best;
  });
}

export default function TripSummaryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { accessToken, error, itinerary, photos, trip } = useTripSummary(tripId);
  const closeWorkspace = useCloseTripWorkspace("/(tabs)/completed");
  const items = (itinerary?.items ?? []).filter((item) => !isItineraryBoundary(item));
  const rated = items.filter((item) => item.visitStatus === "rated").length;
  const unrated = items.filter((item) => item.visitStatus === "unrated").length;
  const notVisited = items.filter((item) => item.visitStatus === "not_visited").length;
  const hero = selectTripSummaryHero(items, photos);
  const heroSource = hero ? tripPhotoImageSource(hero.photo, hero.uri, accessToken) : undefined;
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeWorkspace();
      return true;
    });
    return () => subscription.remove();
  }, [closeWorkspace]));
  return <>
    <Stack.Screen options={{
      title: "여행 기록",
      headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="뒤로가기" accessibilityHint="이전 화면으로 돌아가기" onPress={() => closeWorkspace()} style={styles.backButton}><View style={styles.backIcon} accessibilityElementsHidden importantForAccessibility="no" /></Pressable>,
    }} />
    <Screen bottomSlot={<TripNavigation tripId={tripId} active="record" />}><AppText variant="micro" color={colors.primary}>PAGES FROM YOUR JOURNEY</AppText>{error && <Card><AppText color={colors.danger}>{error}</AppText></Card>}<AppText variant="display">{trip?.title ?? "여행 기록"}</AppText><AppText color={colors.muted}>{trip ? `${trip.startDate} – ${trip.endDate}` : "기록을 불러오는 중이에요…"}</AppText>{hero && heroSource ? <View style={styles.hero}><Image testID="trip-summary-hero-photo" source={heroSource} cachePolicy="memory-disk" style={styles.heroPhoto} contentFit="cover" accessibilityLabel={`${hero.item.placeName} 여행 대표 사진`} /><View style={styles.heroLabel}><AppText variant="label" color={colors.white} numberOfLines={1}>{hero.item.placeName}</AppText>{typeof hero.item.rating === "number" && <AppText variant="micro" color={`${colors.white}E6`}>{hero.item.rating}점</AppText>}</View></View> : trip ? <TripCover trip={trip} /> : <View style={styles.heroLoading}><AppText variant="caption" color={colors.muted}>대표 이미지를 불러오는 중이에요…</AppText></View>}<View style={styles.stats}><Card style={styles.stat}><AppText variant="title">{rated}</AppText><AppText color={colors.muted}>평가 완료</AppText></Card><Card style={styles.stat}><AppText variant="title">{unrated}</AppText><AppText color={colors.muted}>미평가</AppText></Card><Card style={styles.stat}><AppText variant="title">{notVisited}</AppText><AppText color={colors.muted}>미방문</AppText></Card></View>{trip && itinerary && <TripHistoryInsights trip={trip} items={itinerary.items} />}<Button label="사진·평가·후기 추가/수정" variant="secondary" onPress={() => router.push(`/trips/${tripId}/complete`)} /><Card style={styles.recapCard}><AppText variant="heading">여행 사진으로 캐러셀 만들기</AppText><AppText color={colors.muted}>사진 수에 맞춰 날짜별 장소와 기록을 인스타용 4:5 이미지로 정리해요.</AppText><Button label="캐러셀 미리보기" disabled={!trip || !itinerary} onPress={() => router.push(`/trips/${tripId}/recap`)} /></Card>{photos.length > 0 && <View style={styles.section}><AppText variant="heading">여행 사진 · {photos.length}장</AppText><View style={styles.gallery}>{photos.map((photo) => { const uri = photo.thumbnailUrl ?? photo.optimizedUrl ?? photo.originalUrl; if (!uri) return null; return <Image key={photo.id} source={tripPhotoImageSource(photo, uri, accessToken)} cachePolicy="memory-disk" style={styles.photo} contentFit="cover" accessibilityLabel={photo.filename} />; })}</View></View>}{items.map((item) => <Card key={item.id}><View style={styles.placeHeader}><AppText variant="heading">{item.placeName}</AppText><AppText color={item.visitStatus === "not_visited" ? colors.warning : colors.primary}>{item.visitStatus === "rated" ? `${item.rating}점` : item.visitStatus === "not_visited" ? "미방문" : "미평가"}</AppText></View>{item.review ? <AppText variant="title" style={styles.memory}>{item.review}</AppText> : <AppText color={colors.muted}>남긴 메모가 없어요.</AppText>}</Card>)}<Button label="여행 목록으로 돌아가기" onPress={() => closeWorkspace()} /></Screen>
  </>;
}
const styles = StyleSheet.create({ memory: { paddingVertical: spacing.md }, backButton: { width: touch.minimum, height: touch.minimum, alignItems: "center", justifyContent: "center" }, backIcon: { width: 13, height: 13, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: colors.ink, transform: [{ rotate: "45deg" }], marginLeft: 4 }, hero: { aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden", backgroundColor: colors.line }, heroLoading: { aspectRatio: 16 / 9, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondarySoft }, heroPhoto: { width: "100%", height: "100%" }, heroLabel: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, backgroundColor: `${colors.ink}B3`, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, stats: { flexDirection: "row", gap: spacing.sm }, stat: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm }, recapCard: { backgroundColor: colors.primarySoft }, section: { gap: spacing.sm }, gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, photo: { width: "31%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.line }, placeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm } });
