import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Alert, StyleSheet, TextInput } from "react-native";

import { getEntitlements, type Entitlements } from "@/domains/entitlements/api/entitlements.api";
import { savePrimaryLodging } from "@/domains/places/api/lodgings.api";
import { createTrip } from "@/domains/trips/api/trips.api";
import { CountrySelect } from "@/domains/trips/components/country-select";
import { defaultTravelCountry, type TravelCountry } from "@/domains/trips/components/country-options";
import { DateField } from "@/domains/trips/components/date-field";
import { LodgingSearchField, type SelectedLodging } from "@/domains/trips/components/lodging-search-field";
import { RegionMultiSelect, type SelectedRegion } from "@/domains/trips/components/region-multi-select";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";

function initialDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewTripScreen() {
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState<TravelCountry>(defaultTravelCountry);
  const [regions, setRegions] = useState<SelectedRegion[]>([]);
  const [startDate, setStartDate] = useState(() => initialDate(0));
  const [endDate, setEndDate] = useState(() => initialDate(2));
  const [lodging, setLodging] = useState<SelectedLodging>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [entitlements, setEntitlements] = useState<Entitlements>();
  useFocusEffect(useCallback(() => { void getEntitlements().then(setEntitlements).catch(() => undefined); }, []));
  const limitReached = entitlements?.tripLimit !== null && entitlements !== undefined && entitlements.tripCount >= entitlements.tripLimit;

  const changeCountry = (next: TravelCountry) => {
    setCountry(next);
    setRegions([]);
    setLodging(undefined);
  };

  const changeStartDate = (next: string) => {
    setStartDate(next);
    if (endDate < next) setEndDate(next);
  };

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const trip = await createTrip({
        title: title.trim(),
        destination: country.name,
        regions,
        timezone: country.timezone,
        startDate,
        endDate,
      });
      if (lodging) {
        try {
          await savePrimaryLodging(trip.id, {
            googlePlaceId: lodging.googlePlaceId,
            name: lodging.name,
            address: lodging.address ?? "",
            ...(lodging.latitude !== undefined && lodging.longitude !== undefined
              ? { latitude: lodging.latitude, longitude: lodging.longitude }
              : {}),
          });
        } catch {
          Alert.alert("숙소 저장 실패", "여행은 생성됐지만 숙소를 저장하지 못했어요. 여행 정보에서 다시 선택해 주세요.");
          router.replace(`/trips/${trip.id}/edit`);
          return;
        }
      }
      router.replace(`/trips/${trip.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "여행을 만들지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return <Screen>
    <AppText variant="title">어디로 떠나나요?</AppText>
    <AppText color={colors.muted}>국가와 여러 도시·지역을 선택해 여행 범위를 정해보세요.</AppText>
    <Card>
      <AppText variant="label">여행 이름</AppText>
      <TextInput testID="new-trip-title" value={title} onChangeText={setTitle} placeholder="예: 일본 단풍 여행" style={styles.input} />
      <AppText variant="label">여행 국가</AppText>
      <CountrySelect testID="new-trip-destination" value={country} onChange={changeCountry} />
      <AppText variant="caption" color={colors.muted}>시간대 · {country.timezone} (자동 설정)</AppText>
      <RegionMultiSelect country={country} value={regions} onChange={setRegions} />
      <DateField label="출발일" testID="new-trip-start-date" value={startDate} onChange={changeStartDate} />
      <DateField label="종료일" testID="new-trip-end-date" value={endDate} minimumDate={startDate} onChange={setEndDate} />
      <LodgingSearchField destination={[...regions.map((region) => region.name), country.name].join(", ")} value={lodging} onChange={setLodging} />
    </Card>
    {limitReached && <Card>
      <AppText variant="heading">무료 여행 한도에 도달했어요</AppText>
      <AppText color={colors.muted}>기존 여행을 삭제하거나 Plus를 이용하면 새 여행을 만들 수 있어요.</AppText>
      <Button label="내 여행에서 확인" variant="ghost" onPress={() => router.replace("/(tabs)/trips")} />
    </Card>}
    {error && <AppText color={colors.danger}>{error}</AppText>}
    <Button label={saving ? "여행 만드는 중…" : "여행 만들기"} disabled={saving || limitReached || !title.trim() || regions.length === 0} testID="new-trip-submit" onPress={() => void submit()} />
  </Screen>;
}

const styles = StyleSheet.create({
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink },
});
