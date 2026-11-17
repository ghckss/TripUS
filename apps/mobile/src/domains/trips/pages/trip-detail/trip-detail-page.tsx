import { useCloseTripWorkspace } from "@/shared/ui/trip-workspace";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { EditorialHeading, NotebookRow } from "@/shared/ui/field-notes";
import { TripCover } from "../../components/trip-cover";
import { TripNavigation } from "@/shared/ui/trip-navigation";
import { colors, spacing } from "@/shared/design/tokens";
import { useTripDetail } from "./use-trip-detail";
import { deleteTrip } from "@/domains/trips/api/trips.api";
import { clearTripReminders } from "@/domains/trips/notifications/trip-reminders";
import { useAppDialog } from "@/shared/ui/app-dialog";
import { resolveTripProgress } from "./trip-progress";

export default function TripHomeScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, error, placeCount, reload, scheduledCount } = useTripDetail(tripId);
  const closeWorkspace = useCloseTripWorkspace();
  const path = `/trips/${tripId}` as const;
  const { showDialog } = useAppDialog();
  const progress = trip
    ? resolveTripProgress(trip.startDate, trip.endDate, trip.timezone)
    : { badgeLabel: "여행 예정", heading: "준비가 한창이에요", message: null };
  return (
    <Screen bottomSlot={<TripNavigation tripId={tripId} active="home" />}>
      <Stack.Screen options={{ headerRight: () => trip ? <Pressable accessibilityRole="button" accessibilityLabel="여행 정보 수정" onPress={() => router.push(`${path}/edit`)} style={styles.edit}><AppText variant="caption" color={colors.primary}>편집</AppText></Pressable> : null }} />
      {error && <Card><AppText variant="heading">여행을 불러오지 못했어요</AppText><AppText color={colors.muted}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
      {!trip && !error && <Card><AppText color={colors.muted}>여행을 불러오는 중이에요…</AppText></Card>}
      {trip && <>
        <EditorialHeading eyebrow={`${trip.regions?.map((region) => region.name).join(" · ") || trip.destination} / ${trip.timezone}`} title={trip.title} description={`${trip.startDate} — ${trip.endDate}`} />
        <TripCover trip={trip} />
      </>}
      <View style={styles.progress}>
        <AppText variant="heading">{placeCount > 0 ? `가보고 싶은 ${placeCount}곳을 모았어요` : "여행의 첫 장소를 모아 보세요"}</AppText>
        <AppText variant="caption" color={colors.muted}>{progress.heading} · 일정 {scheduledCount}곳 배치</AppText>
        {progress.message && <AppText variant="caption" color={colors.muted}>{progress.message}</AppText>}
      </View>
      <View>
        <NotebookRow icon="bookmark" title="장소 보관함" description="저장한 장소 확인 · 새 장소 검색" testID="trip-open-places" onPress={() => router.push(`${path}/places`)} />
        <NotebookRow icon="route" title="모은 장소로 일정 만들기" description="여행 스타일에 맞춘 일정 제안" testID="trip-open-ai-plan" onPress={() => router.push(`${path}/ai-plan`)} />
        <NotebookRow icon="route" title="하루의 일정 다듬기" description="날짜별 동선 확인 · 방문 순서 편집" testID="trip-open-itinerary" onPress={() => router.push(`${path}/itinerary`)} />
        <NotebookRow icon="journal" title="다녀온 뒤 기록하기" description="방문한 곳과 짧은 메모 남기기" testID="trip-open-complete" onPress={() => router.push(`${path}/complete`)} />
      </View>
      <Button label="＋ 장소 추가" testID="trip-add-place" variant="ghost" onPress={() => router.push(`${path}/places/new`)} />
      {trip && <Button label="여행 삭제" variant="danger" onPress={() => showDialog({
        title: "여행을 삭제할까요?",
        message: `${trip.title}의 일정, 사진과 기록을 더 이상 앱에서 볼 수 없어요.`,
        actions: [
          { label: "취소", variant: "ghost" },
          { label: "삭제", variant: "danger", onPress: () => void deleteTrip(tripId).then(async () => {
          await clearTripReminders(tripId);
          closeWorkspace();
          }).catch(() => showDialog({ title: "삭제하지 못했어요", message: "잠시 후 다시 시도해 주세요." })) },
        ],
      })} />}
    </Screen>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, edit: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }, progress: { marginVertical: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: spacing.md, gap: spacing.sm } });
