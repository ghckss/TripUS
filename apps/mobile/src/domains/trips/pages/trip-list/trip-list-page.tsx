import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { useTripList } from "./use-trip-list";

export default function TripsScreen() {
  const { trips, loading, error, reload } = useTripList();
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View><AppText variant="caption" color={colors.muted}>안녕하세요, 여행자님</AppText><AppText variant="title">내 여행</AppText></View>
        <Button label="＋ 새 여행" testID="trips-new" onPress={() => router.push("/trips/new")} style={styles.newButton} />
      </View>
      <AppText variant="heading">다가오는 여행</AppText>
      {loading && <Card><AppText color={colors.muted}>여행을 불러오는 중이에요…</AppText></Card>}
      {error && <Card><AppText variant="heading">여행을 불러오지 못했어요</AppText><AppText color={colors.muted}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
      {!loading && !error && trips.length === 0 && <Card><AppText variant="heading">첫 여행을 만들어 보세요</AppText><AppText color={colors.muted}>여행지를 정한 뒤 장소를 하나씩 모을 수 있어요.</AppText></Card>}
      {trips.map((trip) => (
        <Pressable key={trip.id} testID={`trip-${trip.id}`} onPress={() => router.push(`/trips/${trip.id}`)}>
          <Card style={styles.tripCard}>
            <View style={styles.row}><Pill label="여행 예정" selected /><AppText variant="caption" color={colors.muted}>{trip.timezone}</AppText></View>
            <AppText variant="title">{trip.title}</AppText>
            <AppText color={colors.muted}>{trip.startDate} – {trip.endDate} · {trip.regions?.length ? trip.regions.map((region) => region.name).join(" · ") : trip.destination}</AppText>
            <AppText variant="label" color={colors.primary}>여행 준비 이어가기 →</AppText>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { paddingTop: 64 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, newButton: { minHeight: 44, paddingHorizontal: spacing.md }, tripCard: { backgroundColor: colors.primarySoft }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } });
