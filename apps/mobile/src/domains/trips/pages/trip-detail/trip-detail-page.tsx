import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { useTripDetail } from "./use-trip-detail";
import { deleteTrip } from "@/domains/trips/api/trips.api";
import { clearTripReminders } from "@/domains/trips/notifications/trip-reminders";
import { useAppDialog } from "@/shared/ui/app-dialog";
import { resolveTripProgress } from "./trip-progress";

export default function TripHomeScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, error, placeCount, reload, scheduledCount } = useTripDetail(tripId);
  const path = `/trips/${tripId}` as const;
  const { showDialog } = useAppDialog();
  const progress = trip
    ? resolveTripProgress(trip.startDate, trip.endDate, trip.timezone)
    : { badgeLabel: "여행 예정", heading: "준비가 한창이에요" };
  return (
    <Screen>
      {error && <Card><AppText variant="heading">여행을 불러오지 못했어요</AppText><AppText color={colors.muted}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
      {!trip && !error && <Card><AppText color={colors.muted}>여행을 불러오는 중이에요…</AppText></Card>}
      {trip && <><View style={styles.row}><Pill label={progress.badgeLabel} selected /><AppText variant="caption" color={colors.muted}>{trip.timezone}</AppText></View><AppText variant="title">{trip.title}</AppText><AppText color={colors.muted}>{trip.startDate} – {trip.endDate} · {trip.regions?.length ? trip.regions.map((region) => region.name).join(" · ") : trip.destination}</AppText></>}
      <Card style={styles.progress}><AppText variant="heading">{progress.heading}</AppText><AppText color={colors.muted}>장소 {placeCount}곳 저장 · 일정 {scheduledCount}곳 배치</AppText></Card>
      {trip && <Button label="여행 정보 수정" variant="ghost" onPress={() => router.push(`${path}/edit`)} />}
      <Button label="＋ 장소 추가" testID="trip-add-place" onPress={() => router.push(`${path}/places/new`)} />
      <Pressable testID="trip-open-places" onPress={() => router.push(`${path}/places`)}><Card><AppText variant="heading">📍 장소 보관함</AppText><AppText color={colors.muted}>저장한 모든 장소를 한 목록에서 확인해요.</AppText></Card></Pressable>
      <Pressable testID="trip-open-itinerary" onPress={() => router.push(`${path}/itinerary`)}><Card><AppText variant="heading">🗓 일정 편집</AppText><AppText color={colors.muted}>날짜 배치와 일정 포함 여부를 관리해요.</AppText></Card></Pressable>
      <Pressable testID="trip-open-ai-plan" onPress={() => router.push(`${path}/ai-plan`)}><Card><AppText variant="heading">✨ AI 일정 만들기</AppText><AppText color={colors.muted}>여행 스타일을 고르면 저장한 장소로 일정을 제안해요.</AppText></Card></Pressable>
      <Button label="여행 완료 정리" testID="trip-open-complete" variant="secondary" onPress={() => router.push(`${path}/complete`)} />
      {trip && <Button label="여행 삭제" variant="danger" onPress={() => showDialog({
        title: "여행을 삭제할까요?",
        message: `${trip.title}의 일정, 사진과 기록을 더 이상 앱에서 볼 수 없어요.`,
        actions: [
          { label: "취소", variant: "ghost" },
          { label: "삭제", variant: "danger", onPress: () => void deleteTrip(tripId).then(async () => {
          await clearTripReminders(tripId);
          router.replace("/(tabs)/trips");
          }).catch(() => showDialog({ title: "삭제하지 못했어요", message: "잠시 후 다시 시도해 주세요." })) },
        ],
      })} />}
    </Screen>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, progress: { marginVertical: spacing.sm, backgroundColor: colors.primarySoft } });
