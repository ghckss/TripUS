import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { EditorialHeading, FieldIllustration, FieldIcon } from "@/shared/ui/field-notes";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { useCompletedTrips } from "@/domains/trip-records";
import { TripCover } from "../../components/trip-cover";
import { useTripList } from "./use-trip-list";

export default function TripsScreen() {
  const { trips, loading, error, reload } = useTripList();
  const { trips: completed, error: historyError, loading: historyLoading, reload: reloadHistory } = useCompletedTrips();
  return <Screen contentStyle={styles.content}>
    <View style={styles.header}><AppText variant="heading" style={styles.wordmark}>trip<AppText variant="heading" color={colors.primary}>us</AppText></AppText><Pressable accessibilityRole="button" accessibilityLabel="프로필 열기" testID="home-menu" onPress={() => router.push("/(tabs)/profile")} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}><View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.menuIcon}><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></View></Pressable></View>
    <AppText variant="caption" color={colors.muted}>안녕하세요, 여행자님</AppText>
    <EditorialHeading title={"이번엔, 어디에서\n머물러 볼까요."} />
    <View style={styles.header}><AppText variant="micro" color={colors.muted}>YOUR NEXT CHAPTER</AppText><Pressable accessibilityRole="button" accessibilityLabel="새 여행 만들기" testID="trips-new" onPress={() => router.push("/trips/new")} style={styles.add}><AppText color={colors.primary} style={styles.plus}>＋</AppText></Pressable></View>
    {loading && <Card><AppText color={colors.muted}>여행을 불러오는 중이에요…</AppText></Card>}
    {error && <Card><AppText variant="heading">여행을 불러오지 못했어요</AppText><AppText color={colors.muted}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
    {!loading && !error && trips.length === 0 && <Card><FieldIllustration /><AppText variant="title">아직 쓰지 않은 여행 이야기</AppText><AppText color={colors.muted}>여행지를 정하고 가보고 싶은 곳을 모아 보세요.</AppText><Button label="첫 여행 만들기" onPress={() => router.push("/trips/new")} /></Card>}
    {trips.map((trip) => <Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={`${trip.title} 여행 열기`} testID={`trip-${trip.id}`} onPress={() => router.push(`/trips/${trip.id}`)} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.tripCard}>
        <TripCover trip={trip} />
        <View style={styles.cardText}><AppText variant="title">{trip.title}</AppText><AppText variant="caption" color={colors.muted}>{trip.regions?.length ? trip.regions.map((region) => region.name).join(" · ") : trip.destination} · {trip.startDate} — {trip.endDate}</AppText>
          <View style={styles.cardFooter}><FieldIcon name="bookmark" color={colors.primary} /><AppText variant="micro" color={colors.muted}>나만의 여행 수첩</AppText><AppText variant="micro" color={colors.primary} style={styles.open}>여행 열기 ↗</AppText></View>
        </View>
      </Card>
    </Pressable>)}
    <View style={styles.historyHeading}><AppText variant="label">다녀온 여행</AppText><Pressable accessibilityRole="button" accessibilityLabel="지난 여행 모두 보기" onPress={() => router.push("/(tabs)/completed")} style={styles.profile}><AppText variant="caption" color={colors.primary}>모두 보기 ›</AppText></Pressable></View>
    {completed.slice(0, 3).map((trip) => <Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={`${trip.title} 여행 기록 열기`} onPress={() => router.push(`/trips/${trip.id}/summary`)} style={styles.historyRow}><TripCover trip={trip} compact /><View style={styles.historyText}><AppText variant="label">{trip.title}</AppText><AppText variant="micro" color={colors.muted}>{trip.startDate} — {trip.endDate}</AppText></View><AppText color={colors.muted}>›</AppText></Pressable>)}
    {historyError && <Button label="지난 여행 다시 불러오기" variant="ghost" onPress={() => void reloadHistory()} />}
    {historyLoading && <AppText variant="caption" color={colors.muted}>지난 여행을 불러오는 중이에요…</AppText>}
    {!historyLoading && !historyError && completed.length === 0 && <AppText variant="caption" color={colors.muted}>다녀온 여행의 기억은 여기에 차곡차곡 쌓여요.</AppText>}
  </Screen>;
}
const styles = StyleSheet.create({
  content: { paddingTop: 64, gap: spacing.compact }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, wordmark: { fontSize: 23, letterSpacing: -0.7 },
  menuButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  menuIcon: { width: 24, height: 24, justifyContent: "center", gap: 5 },
  menuLine: { width: 24, height: 2, borderRadius: 1, backgroundColor: colors.ink },
  profile: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }, add: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, plus: { fontSize: 26 },
  tripCard: { padding: spacing.sm, gap: 0, borderRadius: radius.md },
  cardText: { padding: spacing.compact, gap: spacing.sm }, cardFooter: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.compact, marginTop: spacing.xs }, open: { marginLeft: "auto" },
  historyHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }, historyRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line }, historyText: { flex: 1, gap: spacing.xs }, pressed: { opacity: 0.7 },
});
