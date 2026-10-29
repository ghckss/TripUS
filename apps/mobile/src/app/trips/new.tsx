import { router } from "expo-router";
import { StyleSheet, TextInput } from "react-native";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { colors, radius, spacing } from "@/design/tokens";
import { mockTrip } from "@/mocks/trip";

export default function NewTripScreen() {
  return (
    <Screen>
      <AppText variant="title">어디로 떠나나요?</AppText>
      <AppText color={colors.muted}>기본 정보는 언제든 다시 바꿀 수 있어요.</AppText>
      <Card>
        <AppText variant="label">여행 이름</AppText><TextInput defaultValue={mockTrip.title} style={styles.input} />
        <AppText variant="label">여행지</AppText><TextInput defaultValue={mockTrip.destination} style={styles.input} />
        <AppText variant="label">여행 기간</AppText><TextInput defaultValue={mockTrip.dates} style={styles.input} />
      </Card>
      <Button label="여행 만들기" onPress={() => router.replace(`/trips/${mockTrip.id}`)} />
    </Screen>
  );
}
const styles = StyleSheet.create({ input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink } });
