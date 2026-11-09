import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import { getPrimaryLodging, savePrimaryLodging } from "@/domains/places/api/lodgings.api";
import { getTrip, updateTrip } from "@/domains/trips/api/trips.api";
import { CountrySelect } from "@/domains/trips/components/country-select";
import { defaultTravelCountry, resolveTravelCountry, type TravelCountry } from "@/domains/trips/components/country-options";
import { DateField } from "@/domains/trips/components/date-field";
import { LodgingSearchField, type SelectedLodging } from "@/domains/trips/components/lodging-search-field";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";

export default function EditTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState<TravelCountry>(defaultTravelCountry);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lodging, setLodging] = useState<SelectedLodging>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void Promise.all([getTrip(tripId), getPrimaryLodging(tripId)]).then(([trip, currentLodging]) => {
      setTitle(trip.title);
      setCountry(resolveTravelCountry(trip.destination, trip.timezone));
      setStartDate(trip.startDate);
      setEndDate(trip.endDate);
      setLodging(currentLodging ? {
        googlePlaceId: currentLodging.googlePlaceId ?? undefined,
        name: currentLodging.name,
        address: currentLodging.address,
        latitude: currentLodging.latitude,
        longitude: currentLodging.longitude,
      } : undefined);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "여행 정보를 불러오지 못했어요."))
      .finally(() => setLoading(false));
  }, [tripId]);

  const changeCountry = (next: TravelCountry) => {
    setCountry(next);
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
      await updateTrip(tripId, {
        title: title.trim(),
        destination: country.name,
        timezone: country.timezone,
        startDate,
        endDate,
      });
      await savePrimaryLodging(tripId, {
        googlePlaceId: lodging?.googlePlaceId,
        name: lodging?.name ?? "",
        address: lodging?.address ?? "",
        ...(lodging?.latitude !== undefined && lodging.longitude !== undefined
          ? { latitude: lodging.latitude, longitude: lodging.longitude }
          : {}),
      });
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "여행 정보를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return <Screen>
    <AppText variant="title">여행 기본 정보</AppText>
    <AppText color={colors.muted}>국가, 일정과 지도에서 찾은 기본 숙소를 변경할 수 있어요.</AppText>
    <Card>
      <AppText variant="label">여행 이름</AppText>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} />
      <AppText variant="label">여행 국가</AppText>
      <CountrySelect value={country} onChange={changeCountry} />
      <AppText variant="caption" color={colors.muted}>시간대 · {country.timezone} (자동 설정)</AppText>
      {startDate && <DateField label="출발일" value={startDate} onChange={changeStartDate} />}
      {endDate && <DateField label="종료일" value={endDate} minimumDate={startDate} onChange={setEndDate} />}
      <LodgingSearchField destination={country.name} value={lodging} onChange={setLodging} />
    </Card>
    {error && <AppText color={colors.danger}>{error}</AppText>}
    <Button label={saving ? "저장 중…" : "변경사항 저장"} disabled={loading || saving || !title.trim() || !startDate || !endDate} onPress={() => void submit()} />
  </Screen>;
}

const styles = StyleSheet.create({
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink, marginBottom: spacing.md },
});
