import { router, useLocalSearchParams } from "expo-router";

import { colors } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";

import { useExternalPlaceSave } from "./use-external-place-save";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function ExternalPlaceSavePage() {
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const query = first(params.query).trim();
  const { error, loading, reload, trips } = useExternalPlaceSave();

  return <Screen>
    <AppText variant="title">어느 여행에 저장할까요?</AppText>
    <AppText color={colors.muted}>
      {query ? `“${query}”을(를) 저장할 여행을 선택해 주세요.` : "저장할 장소를 검색할 여행을 선택해 주세요."}
    </AppText>
    {loading && <Card><AppText color={colors.muted}>여행을 불러오는 중이에요…</AppText></Card>}
    {error && <Card>
      <AppText variant="heading">여행을 불러오지 못했어요</AppText>
      <AppText color={colors.muted}>{error}</AppText>
      <Button label="다시 시도" variant="ghost" onPress={() => void reload()} />
    </Card>}
    {!loading && !error && trips.length === 0 && <Card>
      <AppText variant="heading">먼저 여행을 만들어 주세요</AppText>
      <Button label="새 여행 만들기" onPress={() => router.replace("/trips/new")} />
    </Card>}
    {trips.map((trip) => <Card key={trip.id}>
      <AppText variant="heading">{trip.title}</AppText>
      <AppText color={colors.muted}>{trip.destination} · {trip.startDate} – {trip.endDate}</AppText>
      <Button
        label="이 여행에 저장"
        onPress={() => router.replace({
          pathname: "/trips/[tripId]/places",
          params: { tripId: trip.id, ...(query ? { query } : {}) },
        })}
      />
    </Card>)}
  </Screen>;
}
