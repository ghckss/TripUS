import DateTimePicker, { type DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";

type TimeFieldProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  testID: string;
};

function parseTime(value: string | null): Date {
  const date = new Date();
  const [hours, minutes] = value?.split(":").map(Number) ?? [];
  date.setHours(hours ?? 12, minutes ?? 0, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function TimeField({ label, value, onChange, testID }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseTime(value));

  const show = () => {
    setDraft(parseTime(value));
    setOpen(true);
  };

  const handleValueChange = (_event: DateTimePickerChangeEvent, date: Date) => {
    if (Platform.OS === "ios") {
      setDraft(date);
      return;
    }
    setOpen(false);
    onChange(formatTime(date));
  };

  const picker = <DateTimePicker
    display={Platform.OS === "ios" ? "spinner" : "default"}
    is24Hour
    locale="ko-KR"
    mode="time"
    minuteInterval={5}
    onDismiss={() => setOpen(false)}
    onValueChange={handleValueChange}
    testID={`${testID}-picker`}
    value={draft}
  />;

  return <View style={styles.container}>
    <AppText variant="label">{label}</AppText>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value ?? "미설정"}`} onPress={show} style={styles.field} testID={testID}>
        <AppText>🕐</AppText>
        <AppText variant="label" style={styles.value}>{value ?? "시각 선택"}</AppText>
        <AppText color={colors.muted}>선택</AppText>
      </Pressable>
      {value && <Button label="해제" variant="ghost" onPress={() => onChange(null)} />}
    </View>
    {open && Platform.OS !== "ios" && picker}
    {Platform.OS === "ios" && <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
      <Pressable accessibilityRole="button" accessibilityLabel="시간 선택 닫기" onPress={() => setOpen(false)} style={styles.backdrop}>
        <Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={styles.panel}>
          <AppText variant="heading">{label}</AppText>
          {picker}
          <Button label="완료" testID={`${testID}-confirm`} onPress={() => { onChange(formatTime(draft)); setOpen(false); }} />
        </Pressable>
      </Pressable>
    </Modal>}
  </View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15, 23, 42, 0.45)", padding: spacing.md },
  container: { gap: spacing.sm },
  field: { flex: 1, minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  panel: { width: "100%", maxWidth: 380, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  value: { flex: 1 },
});
