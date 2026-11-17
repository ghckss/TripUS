import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { useApiQuery } from "@/shared/query/use-resource";
import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";

import { getEntitlements } from "@/domains/entitlements/api/entitlements.api";
import { savePrimaryLodging } from "@/domains/places/api/lodgings.api";
import { createTrip } from "@/domains/trips/api/trips.api";
import { CountrySelect } from "@/domains/trips/components/country-select";
import { defaultTravelCountry, type TravelCountry } from "@/domains/trips/components/country-options";
import { TripDateRangeField } from "@/domains/trips/components/trip-date-range-field";
import { useTripBoundaryPoints } from "@/domains/trips/hooks/use-trip-boundary-points";
import { LodgingSearchField, type SelectedLodging } from "@/domains/trips/components/lodging-search-field";
import { RegionMultiSelect, type SelectedRegion } from "@/domains/trips/components/region-multi-select";
import { isBoundaryPointValid, TripBoundarySearchField } from "@/domains/trips/components/trip-boundary-search-field";
import { safeErrorMessage } from "@/shared/api/trip-us-api";
import { colors, radius, spacing, fonts } from "@/shared/design/tokens";
import { useAppDialog } from "@/shared/ui/app-dialog";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EditorialHeading } from "@/shared/ui/field-notes";
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
  const { showDialog } = useAppDialog();
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState<TravelCountry>(defaultTravelCountry);
  const [regions, setRegions] = useState<SelectedRegion[]>([]);
  const [startDate, setStartDate] = useState(() => initialDate(0));
  const [endDate, setEndDate] = useState(() => initialDate(2));
  const [lodging, setLodging] = useState<SelectedLodging>();
  const { startPoint, endPoint, setStartPoint, setEndPoint, setPoints } = useTripBoundaryPoints();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [initialPeriod] = useState(() => ({ startDate: initialDate(0), endDate: initialDate(2) }));
  const allowNavigation = useUnsavedChanges(Boolean(title.trim() || regions.length || lodging || startPoint || endPoint || country.code !== defaultTravelCountry.code || startDate !== initialPeriod.startDate || endDate !== initialPeriod.endDate), saving);
  const { data: entitlements } = useApiQuery("entitlements", getEntitlements);
  const limitReached = entitlements?.tripLimit !== null && entitlements !== undefined && entitlements.tripCount >= entitlements.tripLimit;

  const changeCountry = (next: TravelCountry) => {
    setCountry(next);
    setRegions([]);
    setLodging(undefined);
    setPoints({});
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
        startPoint: startPoint ?? null,
        endPoint: endPoint ?? null,
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
          showDialog({ title: "숙소 저장 실패", message: "여행은 생성됐지만 숙소를 저장하지 못했어요. 여행 정보에서 다시 선택해 주세요." });
          allowNavigation();
          router.replace(`/trips/${trip.id}/edit`);
          return;
        }
      }
      allowNavigation();
      router.replace(`/trips/${trip.id}`);
    } catch (caught) {
      setError(safeErrorMessage(caught, "여행을 만들지 못했어요."));
    } finally {
      setSaving(false);
    }
  };

  return <Screen>
    <EditorialHeading eyebrow="A NEW CHAPTER" title={"다음 이야기는\n어디에서 시작할까요?"} />
    <AppText color={colors.muted}>국가와 여러 도시·지역을 선택해 여행 범위를 정해보세요.</AppText>
    <View style={styles.form}>
      <AppText variant="label">여행 이름</AppText>
      <TextInput testID="new-trip-title" value={title} onChangeText={setTitle} placeholder="예: 한국 여행" placeholderTextColor={colors.muted} style={styles.input} />
      <AppText variant="label">여행 국가</AppText>
      <CountrySelect testID="new-trip-destination" value={country} onChange={changeCountry} />
      <AppText variant="caption" color={colors.muted}>시간대 · {country.timezone} (자동 설정)</AppText>
      <RegionMultiSelect country={country} value={regions} onChange={setRegions} />
      <TripDateRangeField testID="new-trip-period" startDate={startDate} endDate={endDate} onChange={(range) => { setStartDate(range.startDate); setEndDate(range.endDate); }} />
      <TripBoundarySearchField destination={country.name} kind="start" value={startPoint} onChange={setStartPoint} />
      <TripBoundarySearchField destination={country.name} kind="end" value={endPoint} onChange={setEndPoint} />
      <LodgingSearchField destination={[...regions.map((region) => region.name), country.name].join(", ")} value={lodging} onChange={setLodging} />
    </View>
    {limitReached && <Card>
      <AppText variant="heading">무료 여행 한도에 도달했어요</AppText>
      <AppText color={colors.muted}>기존 여행을 삭제하거나 Plus를 이용하면 새 여행을 만들 수 있어요.</AppText>
      <Button label="내 여행에서 확인" variant="ghost" onPress={() => router.dismissTo("/(tabs)/trips")} />
    </Card>}
    {error && <AppText color={colors.danger}>{error}</AppText>}
    <Button label={saving ? "여행 만드는 중…" : "여행 만들기"} disabled={saving || limitReached || !title.trim() || regions.length === 0 || !isBoundaryPointValid(startPoint) || !isBoundaryPointValid(endPoint)} testID="new-trip-submit" onPress={() => void submit()} />
  </Screen>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.compact },
  input: { fontFamily: fonts.sans, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink },
});
