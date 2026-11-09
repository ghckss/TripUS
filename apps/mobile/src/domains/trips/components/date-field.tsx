import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";

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
    if (event.type === "set" && date) {
      onChange(formatValue(date));
    }
    setOpen(false);
  };

  const picker = <DateTimePicker
    display={Platform.OS === "ios" ? "inline" : "default"}
    locale="ko-KR"
    minimumDate={minimumDate ? parseDate(minimumDate) : undefined}
    mode="date"
    onChange={handleChange}
    style={Platform.OS === "ios" ? styles.picker : undefined}
    testID={testID ? `${testID}-picker` : undefined}
    value={parseDate(value)}
  />;

  return <View style={styles.container}>
    <AppText variant="label">{label}</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${displayValue(value)}`} onPress={() => setOpen(true)} style={styles.field} testID={testID}>
      <AppText>📅</AppText>
      <AppText variant="label" style={styles.value}>{displayValue(value)}</AppText>
      <AppText color={colors.muted}>선택</AppText>
    </Pressable>
    {open && Platform.OS !== "ios" && picker}
    {Platform.OS === "ios" && <Modal
      animationType="fade"
      onRequestClose={() => setOpen(false)}
      transparent
      visible={open}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="달력 닫기" onPress={() => setOpen(false)} style={styles.backdrop}>
        <Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={styles.pickerPanel}>
          <AppText variant="heading">{label} 선택</AppText>
          {picker}
        </Pressable>
      </Pressable>
    </Modal>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  field: { minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  value: { flex: 1 },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15, 23, 42, 0.45)", padding: spacing.md },
  pickerPanel: { width: "100%", maxWidth: 380, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  picker: { width: "100%", alignSelf: "center" },
});
