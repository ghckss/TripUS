import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { useTripSummary } from "./use-trip-summary";

export default function TripSummaryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { error, itinerary, trip } = useTripSummary(tripId);
  const items = itinerary?.items ?? [];
  const rated = items.filter((item) => item.visitStatus === "rated").length;
  const unrated = items.filter((item) => item.visitStatus === "unrated").length;
  const notVisited = items.filter((item) => item.visitStatus === "not_visited").length;
  return <Screen><AppText variant="caption" color={colors.primary}>TRIP COMPLETE</AppText>{error && <Card><AppText color={colors.danger}>{error}</AppText></Card>}<AppText variant="display">{trip?.title ?? "여행 기록"}</AppText><AppText color={colors.muted}>{trip ? `${trip.startDate} – ${trip.endDate}` : "기록을 불러오는 중이에요…"}</AppText><View style={styles.stats}><Card style={styles.stat}><AppText variant="title">{rated}</AppText><AppText color={colors.muted}>평가 완료</AppText></Card><Card style={styles.stat}><AppText variant="title">{unrated}</AppText><AppText color={colors.muted}>미평가</AppText></Card><Card style={styles.stat}><AppText variant="title">{notVisited}</AppText><AppText color={colors.muted}>미방문</AppText></Card></View><Card><AppText variant="heading">사진과 메모</AppText><AppText color={colors.muted}>원본 사진은 사용자 저장 용량 제한 없이 보관하는 정책으로 설계합니다. 업로드 진행 독립 화면은 제공하지 않아요.</AppText></Card><Button label="내 여행으로 돌아가기" onPress={() => router.replace("/(tabs)/trips")} /></Screen>;
}
const styles = StyleSheet.create({ stats: { flexDirection: "row", gap: spacing.sm }, stat: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm } });
