import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { tripUsApiBaseUrl } from "@/shared/api/trip-us-api";
import { useTripSummary } from "./use-trip-summary";

export default function TripSummaryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { accessToken, error, itinerary, photos, trip } = useTripSummary(tripId);
  const items = itinerary?.items ?? [];
  const rated = items.filter((item) => item.visitStatus === "rated").length;
  const unrated = items.filter((item) => item.visitStatus === "unrated").length;
  const notVisited = items.filter((item) => item.visitStatus === "not_visited").length;
  return <Screen><AppText variant="caption" color={colors.primary}>TRIP COMPLETE</AppText>{error && <Card><AppText color={colors.danger}>{error}</AppText></Card>}<AppText variant="display">{trip?.title ?? "여행 기록"}</AppText><AppText color={colors.muted}>{trip ? `${trip.startDate} – ${trip.endDate}` : "기록을 불러오는 중이에요…"}</AppText><View style={styles.stats}><Card style={styles.stat}><AppText variant="title">{rated}</AppText><AppText color={colors.muted}>평가 완료</AppText></Card><Card style={styles.stat}><AppText variant="title">{unrated}</AppText><AppText color={colors.muted}>미평가</AppText></Card><Card style={styles.stat}><AppText variant="title">{notVisited}</AppText><AppText color={colors.muted}>미방문</AppText></Card></View>{photos.length > 0 && <View style={styles.section}><AppText variant="heading">여행 사진 · {photos.length}장</AppText><View style={styles.gallery}>{photos.map((photo) => { const uri = photo.thumbnailUrl ?? photo.optimizedUrl ?? photo.originalUrl; if (!uri) return null; const source = uri.startsWith(tripUsApiBaseUrl) && accessToken ? { uri, headers: { Authorization: `Bearer ${accessToken}` } } : { uri }; return <Image key={photo.id} source={source} style={styles.photo} contentFit="cover" accessibilityLabel={photo.filename} />; })}</View></View>}{items.map((item) => <Card key={item.id}><View style={styles.placeHeader}><AppText variant="heading">{item.placeName}</AppText><AppText color={item.visitStatus === "not_visited" ? colors.warning : colors.primary}>{item.visitStatus === "rated" ? `${item.rating}점` : item.visitStatus === "not_visited" ? "미방문" : "미평가"}</AppText></View>{item.review ? <AppText>{item.review}</AppText> : <AppText color={colors.muted}>남긴 메모가 없어요.</AppText>}</Card>)}<Button label="내 여행으로 돌아가기" onPress={() => router.replace("/(tabs)/trips")} /></Screen>;
}
const styles = StyleSheet.create({ stats: { flexDirection: "row", gap: spacing.sm }, stat: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm }, section: { gap: spacing.sm }, gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, photo: { width: "31%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.line }, placeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm } });
