import { router } from "expo-router";
import { Pressable } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { EditorialHeading, FieldIllustration } from "@/shared/ui/field-notes";
import { Screen } from "@/shared/ui/screen";
import { colors } from "@/shared/design/tokens";
import { Button } from "@/shared/ui/button";
import { useCompletedTrips } from "../../hooks/use-completed-trips";

export default function CompletedScreen() {
  const { error, loading, reload, trips } = useCompletedTrips();
  return <Screen contentStyle={{ paddingTop: 64 }}><EditorialHeading eyebrow="COLLECTED MEMORIES" title={"다녀온 날들,\n남겨둔 이야기."} />{error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}{loading && <Card><AppText color={colors.muted}>기록을 불러오는 중이에요…</AppText></Card>}{!loading && !error && trips.length === 0 && <Card><AppText color={colors.muted}>보관한 여행이 아직 없어요.</AppText></Card>}{trips.map((trip) => <Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={`${trip.title} 여행 기록 열기`} onPress={() => router.push(`/trips/${trip.id}/summary`)}><Card><FieldIllustration /><AppText variant="title">{trip.title}</AppText><AppText color={colors.muted}>{trip.startDate} – {trip.endDate} · {trip.destination}</AppText></Card></Pressable>)}</Screen>;
}
