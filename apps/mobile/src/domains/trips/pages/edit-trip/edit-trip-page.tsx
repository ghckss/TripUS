import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import { getPrimaryLodging, savePrimaryLodging } from "@/domains/places/api/lodgings.api";
import { getTrip, updateTrip } from "@/domains/trips/api/trips.api";
import { CountrySelect } from "@/domains/trips/components/country-select";
import { defaultTravelCountry, resolveTravelCountry, type TravelCountry } from "@/domains/trips/components/country-options";
import { TripDateRangeField } from "@/domains/trips/components/trip-date-range-field";
import { useTripBoundaryPoints } from "@/domains/trips/hooks/use-trip-boundary-points";
import { LodgingSearchField, type SelectedLodging } from "@/domains/trips/components/lodging-search-field";
import { RegionMultiSelect, type SelectedRegion } from "@/domains/trips/components/region-multi-select";
import { isBoundaryPointValid, TripBoundarySearchField } from "@/domains/trips/components/trip-boundary-search-field";
import { safeErrorMessage } from "@/shared/api/trip-us-api";
import { colors, radius, spacing, fonts } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";

export default function EditTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState<TravelCountry>(defaultTravelCountry);
  const [regions, setRegions] = useState<SelectedRegion[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lodging, setLodging] = useState<SelectedLodging>();
  const { startPoint, endPoint, setStartPoint, setEndPoint, setPoints } = useTripBoundaryPoints();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [savedForm, setSavedForm] = useState<string>();
  const form = JSON.stringify({ title, country, regions, startDate, endDate, lodging, startPoint, endPoint });
  const allowNavigation = useUnsavedChanges(savedForm !== undefined && savedForm !== form, saving);

  useEffect(() => {
    void Promise.all([getTrip(tripId), getPrimaryLodging(tripId)]).then(([trip, currentLodging]) => {
      const nextCountry = resolveTravelCountry(trip.destination, trip.timezone);
      const nextLodging = currentLodging ? { googlePlaceId: currentLodging.googlePlaceId ?? undefined, name: currentLodging.name, address: currentLodging.address, latitude: currentLodging.latitude, longitude: currentLodging.longitude } : undefined;
      setSavedForm(JSON.stringify({ title: trip.title, country: nextCountry, regions: trip.regions ?? [], startDate: trip.startDate, endDate: trip.endDate, lodging: nextLodging, startPoint: trip.startPoint ?? undefined, endPoint: trip.endPoint ?? undefined }));
      setTitle(trip.title);
      setCountry(resolveTravelCountry(trip.destination, trip.timezone));
      setRegions(trip.regions ?? []);
      setStartDate(trip.startDate);
      setEndDate(trip.endDate);
      setPoints({ startPoint: trip.startPoint ?? undefined, endPoint: trip.endPoint ?? undefined });
      setLodging(currentLodging ? {
        googlePlaceId: currentLodging.googlePlaceId ?? undefined,
        name: currentLodging.name,
        address: currentLodging.address,
        latitude: currentLodging.latitude,
        longitude: currentLodging.longitude,
      } : undefined);
    }).catch((caught) => setError(safeErrorMessage(caught, "여행 정보를 불러오지 못했어요.")))
      .finally(() => setLoading(false));
  }, [tripId, setPoints]);

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
      await updateTrip(tripId, {
        title: title.trim(),
        destination: country.name,
        regions,
        timezone: country.timezone,
        startDate,
        endDate,
        startPoint: startPoint ?? null,
        endPoint: endPoint ?? null,
      });
      await savePrimaryLodging(tripId, {
        googlePlaceId: lodging?.googlePlaceId,
        name: lodging?.name ?? "",
        address: lodging?.address ?? "",
        ...(lodging?.latitude !== undefined && lodging.longitude !== undefined
          ? { latitude: lodging.latitude, longitude: lodging.longitude }
          : {}),
      });
      allowNavigation();
      router.back();
    } catch (caught) {
      setError(safeErrorMessage(caught, "여행 정보를 저장하지 못했어요."));
    } finally {
      setSaving(false);
    }
  };

  return <Screen>
    <AppText variant="title">여행 기본 정보</AppText>
    <AppText color={colors.muted}>국가, 도시·지역, 일정과 기본 숙소를 변경할 수 있어요.</AppText>
    <Card>
      <AppText variant="label">여행 이름</AppText>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} />
      <AppText variant="label">여행 국가</AppText>
      <CountrySelect value={country} onChange={changeCountry} />
      <AppText variant="caption" color={colors.muted}>시간대 · {country.timezone} (자동 설정)</AppText>
      <RegionMultiSelect country={country} value={regions} onChange={setRegions} />
      {startDate && endDate && <TripDateRangeField testID="edit-trip-period" startDate={startDate} endDate={endDate} onChange={(range) => { setStartDate(range.startDate); setEndDate(range.endDate); }} />}
      <TripBoundarySearchField destination={country.name} kind="start" value={startPoint} onChange={setStartPoint} />
      <TripBoundarySearchField destination={country.name} kind="end" value={endPoint} onChange={setEndPoint} />
      <LodgingSearchField destination={[...regions.map((region) => region.name), country.name].join(", ")} value={lodging} onChange={setLodging} />
    </Card>
    {error && <AppText color={colors.danger}>{error}</AppText>}
    <Button label={saving ? "저장 중…" : "변경사항 저장"} disabled={loading || saving || !title.trim() || !startDate || !endDate || regions.length === 0 || !isBoundaryPointValid(startPoint) || !isBoundaryPointValid(endPoint)} onPress={() => void submit()} />
  </Screen>;
}

const styles = StyleSheet.create({
  input: { fontFamily: fonts.sans, minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink, marginBottom: spacing.md },
});
