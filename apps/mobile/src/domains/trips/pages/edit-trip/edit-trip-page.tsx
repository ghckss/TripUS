import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import { getTrip, updateTrip } from "@/domains/trips/api/trips.api";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getTrip(tripId).then((trip) => {
      setTitle(trip.title);
      setDestination(trip.destination);
      setTimezone(trip.timezone);
      setStartDate(trip.startDate);
      setEndDate(trip.endDate);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "여행 정보를 불러오지 못했어요."));
  }, [tripId]);

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await updateTrip(tripId, { title, destination, timezone, startDate, endDate });
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "여행 정보를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return <Screen>
    <AppText variant="title">여행 기본 정보</AppText>
    <AppText color={colors.muted}>여행 이름, 목적지와 날짜를 변경할 수 있어요.</AppText>
    <Card>
      <AppText variant="label">여행 이름</AppText><TextInput value={title} onChangeText={setTitle} style={styles.input} />
      <AppText variant="label">여행지</AppText><TextInput value={destination} onChangeText={setDestination} style={styles.input} />
      <AppText variant="label">시간대</AppText><TextInput value={timezone} onChangeText={setTimezone} style={styles.input} autoCapitalize="none" />
      <AppText variant="label">시작일</AppText><TextInput value={startDate} onChangeText={setStartDate} style={styles.input} placeholder="YYYY-MM-DD" />
      <AppText variant="label">종료일</AppText><TextInput value={endDate} onChangeText={setEndDate} style={styles.input} placeholder="YYYY-MM-DD" />
    </Card>
    {error && <AppText color={colors.danger}>{error}</AppText>}
    <Button label={saving ? "저장 중…" : "변경사항 저장"} disabled={saving || !title || !destination || !startDate || !endDate} onPress={() => void submit()} />
  </Screen>;
}

const styles = StyleSheet.create({ input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink, marginBottom: spacing.md } });
