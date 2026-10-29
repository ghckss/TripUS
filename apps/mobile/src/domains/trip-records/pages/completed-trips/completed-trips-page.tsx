import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { colors } from "@/shared/design/tokens";
import { Button } from "@/shared/ui/button";
import { useCompletedTrips } from "./use-completed-trips";

export default function CompletedScreen() {
  const { error, reload, trips } = useCompletedTrips();
  return <Screen contentStyle={{ paddingTop: 64 }}><AppText variant="title">지난 여행</AppText>{error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}{!error && trips.length === 0 && <Card><AppText color={colors.muted}>보관한 여행이 아직 없어요.</AppText></Card>}{trips.map((trip) => <Card key={trip.id}><AppText variant="heading">{trip.title}</AppText><AppText color={colors.muted}>{trip.startDate} – {trip.endDate} · {trip.destination}</AppText></Card>)}</Screen>;
}
