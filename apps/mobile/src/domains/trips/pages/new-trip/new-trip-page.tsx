import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Alert, StyleSheet, TextInput } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { createTrip } from "@/domains/trips/api/trips.api";
import { getEntitlements, type Entitlements } from "@/domains/entitlements/api/entitlements.api";
import { savePrimaryLodging } from "@/domains/places/api/lodgings.api";

export default function NewTripScreen() {
  const [title, setTitle] = useState("서울 가을 여행");
  const [destination, setDestination] = useState("서울");
  const [startDate, setStartDate] = useState("2026-10-31");
  const [endDate, setEndDate] = useState("2026-11-02");
  const [lodgingName, setLodgingName] = useState("");
  const [lodgingAddress, setLodgingAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [entitlements, setEntitlements] = useState<Entitlements>();
  useFocusEffect(useCallback(() => { void getEntitlements().then(setEntitlements).catch(() => undefined); }, []));
  const limitReached = entitlements?.tripLimit !== null && entitlements !== undefined && entitlements.tripCount >= entitlements.tripLimit;

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const trip = await createTrip({ title, destination, timezone: "Asia/Seoul", startDate, endDate });
      if (lodgingName.trim()) {
        try {
          await savePrimaryLodging(trip.id, { name: lodgingName, address: lodgingAddress });
        } catch {
          Alert.alert("숙소 저장 실패", "여행은 생성됐지만 숙소를 저장하지 못했어요. 여행 정보에서 다시 입력해 주세요.");
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

  return (
    <Screen>
      <AppText variant="title">어디로 떠나나요?</AppText>
      <AppText color={colors.muted}>기본 정보는 언제든 다시 바꿀 수 있어요.</AppText>
      <Card>
        <AppText variant="label">여행 이름</AppText><TextInput testID="new-trip-title" value={title} onChangeText={setTitle} style={styles.input} />
        <AppText variant="label">여행지</AppText><TextInput testID="new-trip-destination" value={destination} onChangeText={setDestination} style={styles.input} />
        <AppText variant="label">시작일</AppText><TextInput testID="new-trip-start-date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" style={styles.input} />
        <AppText variant="label">종료일</AppText><TextInput testID="new-trip-end-date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" style={styles.input} />
        <AppText variant="heading">기본 숙소</AppText>
        <AppText color={colors.muted}>선택 사항이며 일정 편집에서 날짜별로 변경할 수 있어요.</AppText>
        <AppText variant="label">숙소명</AppText><TextInput testID="new-trip-lodging-name" value={lodgingName} onChangeText={setLodgingName} placeholder="예: 서울 시청 호텔" style={styles.input} />
        <AppText variant="label">숙소 주소</AppText><TextInput testID="new-trip-lodging-address" value={lodgingAddress} onChangeText={setLodgingAddress} placeholder="선택 입력" style={styles.input} />
      </Card>
      {limitReached && <Card>
        <AppText variant="heading">무료 여행 한도에 도달했어요</AppText>
        <AppText color={colors.muted}>기존 여행을 삭제하거나 Plus를 이용하면 새 여행을 만들 수 있어요.</AppText>
        <Button label="내 여행에서 확인" variant="ghost" onPress={() => router.replace("/(tabs)/trips")} />
      </Card>}
      {error && <AppText color={colors.danger}>{error}</AppText>}
      <Button label={saving ? "여행 만드는 중…" : "여행 만들기"} disabled={saving || limitReached} testID="new-trip-submit" onPress={() => void submit()} />
    </Screen>
  );
}
const styles = StyleSheet.create({ input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink } });
