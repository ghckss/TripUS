import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { mockTrip } from "@/domains/trips/model/trip.fixture";

export default function TripsScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View><AppText variant="caption" color={colors.muted}>안녕하세요, 여행자님</AppText><AppText variant="title">내 여행</AppText></View>
        <Button label="＋ 새 여행" onPress={() => router.push("/trips/new")} style={styles.newButton} />
      </View>
      <AppText variant="heading">다가오는 여행</AppText>
      <Pressable onPress={() => router.push(`/trips/${mockTrip.id}`)}>
        <Card style={styles.tripCard}>
          <View style={styles.row}><Pill label="D-2" selected /><AppText variant="caption" color={colors.muted}>2명</AppText></View>
          <AppText variant="title">{mockTrip.title}</AppText>
          <AppText color={colors.muted}>{mockTrip.dates} · {mockTrip.destination}</AppText>
          <AppText variant="label" color={colors.primary}>여행 준비 이어가기 →</AppText>
        </Card>
      </Pressable>
      <Card><AppText variant="heading">장소부터 가볍게 모아보세요</AppText><AppText color={colors.muted}>일정에 넣을지는 나중에 일정 편집에서 결정할 수 있어요.</AppText></Card>
    </Screen>
  );
}
const styles = StyleSheet.create({ content: { paddingTop: 64 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, newButton: { minHeight: 44, paddingHorizontal: spacing.md }, tripCard: { backgroundColor: colors.primarySoft }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } });
