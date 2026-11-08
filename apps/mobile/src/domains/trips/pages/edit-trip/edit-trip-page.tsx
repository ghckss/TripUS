import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import { getTrip, updateTrip } from "@/domains/trips/api/trips.api";
import { getPrimaryLodging, savePrimaryLodging } from "@/domains/places/api/lodgings.api";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";

export default function EditTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lodgingName, setLodgingName] = useState("");
  const [lodgingAddress, setLodgingAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void Promise.all([getTrip(tripId), getPrimaryLodging(tripId)]).then(([trip, lodging]) => {
      setTitle(trip.title);
      setDestination(trip.destination);
      setTimezone(trip.timezone);
      setStartDate(trip.startDate);
      setEndDate(trip.endDate);
      setLodgingName(lodging?.name ?? "");
      setLodgingAddress(lodging?.address ?? "");
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "여행 정보를 불러오지 못했어요."));
  }, [tripId]);

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await updateTrip(tripId, { title, destination, timezone, startDate, endDate });
      await savePrimaryLodging(tripId, { name: lodgingName, address: lodgingAddress });
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "여행 정보를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return <Screen>
    <AppText variant="title">여행 기본 정보</AppText>
    <AppText color={colors.muted}>여행 이름, 목적지, 날짜와 기본 숙소를 변경할 수 있어요.</AppText>
    <Card>
      <AppText variant="label">여행 이름</AppText><TextInput value={title} onChangeText={setTitle} style={styles.input} />
      <AppText variant="label">여행지</AppText><TextInput value={destination} onChangeText={setDestination} style={styles.input} />
      <AppText variant="label">시간대</AppText><TextInput value={timezone} onChangeText={setTimezone} style={styles.input} autoCapitalize="none" />
      <AppText variant="label">시작일</AppText><TextInput value={startDate} onChangeText={setStartDate} style={styles.input} placeholder="YYYY-MM-DD" />
      <AppText variant="label">종료일</AppText><TextInput value={endDate} onChangeText={setEndDate} style={styles.input} placeholder="YYYY-MM-DD" />
      <AppText variant="heading">기본 숙소</AppText>
      <AppText color={colors.muted}>비워 두면 기본 숙소를 사용하지 않아요. 날짜별 숙소는 일정 편집에서 바꿀 수 있어요.</AppText>
      <AppText variant="label">숙소명</AppText><TextInput testID="edit-trip-lodging-name" value={lodgingName} onChangeText={setLodgingName} style={styles.input} placeholder="예: 서울 시청 호텔" />
      <AppText variant="label">숙소 주소</AppText><TextInput testID="edit-trip-lodging-address" value={lodgingAddress} onChangeText={setLodgingAddress} style={styles.input} placeholder="선택 입력" />
    </Card>
    {error && <AppText color={colors.danger}>{error}</AppText>}
    <Button label={saving ? "저장 중…" : "변경사항 저장"} disabled={saving || !title || !destination || !startDate || !endDate} onPress={() => void submit()} />
  </Screen>;
}

const styles = StyleSheet.create({ input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink, marginBottom: spacing.md } });
