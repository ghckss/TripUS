import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: string;
  testID?: string;
};

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12);
}

function formatValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayValue(value: string): string {
  const date = parseDate(value);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function DateField({ label, value, onChange, minimumDate, testID }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "ios") setOpen(false);
    if (event.type === "set" && date) onChange(formatValue(date));
  };

  return <View style={styles.container}>
    <AppText variant="label">{label}</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${displayValue(value)}`} onPress={() => setOpen(true)} style={styles.field} testID={testID}>
      <AppText>📅</AppText>
      <AppText variant="label" style={styles.value}>{displayValue(value)}</AppText>
      <AppText color={colors.muted}>선택</AppText>
    </Pressable>
    {open && <View style={styles.pickerPanel}>
      <DateTimePicker
        display={Platform.OS === "ios" ? "inline" : "default"}
        locale="ko-KR"
        minimumDate={minimumDate ? parseDate(minimumDate) : undefined}
        mode="date"
        onChange={handleChange}
        testID={testID ? `${testID}-picker` : undefined}
        value={parseDate(value)}
      />
      {Platform.OS === "ios" && <Button label="날짜 선택 완료" variant="ghost" onPress={() => setOpen(false)} />}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  field: { minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  value: { flex: 1 },
  pickerPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.sm },
});
