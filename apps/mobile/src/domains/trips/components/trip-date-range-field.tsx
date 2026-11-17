import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";

type Range = { startDate: string; endDate: string };
type Props = Range & { onChange: (range: Range) => void; testID?: string };
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const parse = (date: string) => new Date(`${date}T12:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
function label(date: string) {
  const day = parse(date);
  return `${day.getUTCFullYear()}.${String(day.getUTCMonth() + 1).padStart(2, "0")}.${String(day.getUTCDate()).padStart(2, "0")} (${weekdays[day.getUTCDay()]})`;
}

export function TripDateRangeField({ startDate, endDate, onChange, testID = "trip-date-range" }: Props) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState<string | undefined>(endDate);
  const [phase, setPhase] = useState<"start" | "end">("start");
  const [month, setMonth] = useState(() => monthStart(startDate));
  const monthDate = parse(month);
  const year = monthDate.getUTCFullYear();
  const monthIndex = monthDate.getUTCMonth();
  const offset = monthDate.getUTCDay();
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells = Math.ceil((offset + count) / 7) * 7;
  const show = () => {
    setStart(startDate); setEnd(endDate); setPhase("start"); setMonth(monthStart(startDate)); setOpen(true);
  };
  const select = (date: string) => {
    if (phase === "start" || date < start) {
      setStart(date); setEnd(undefined); setPhase("end");
    } else {
      setEnd(date);
    }
  };
  const shiftMonth = (delta: number) => setMonth(iso(new Date(Date.UTC(year, monthIndex + delta, 1))));
  return <View style={styles.container}>
    <AppText variant="label">여행 기간</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel={`여행 기간, ${label(startDate)}부터 ${label(endDate)}까지`} onPress={show} testID={testID} style={styles.field}>
      <View style={styles.endpoint}><AppText variant="micro" color={colors.muted}>시작일</AppText><AppText variant="label">{label(startDate)}</AppText></View>
      <AppText color={colors.muted}>~</AppText>
      <View style={styles.endpoint}><AppText variant="micro" color={colors.muted}>종료일</AppText><AppText variant="label">{label(endDate)}</AppText></View>
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="여행 기간 선택 닫기" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.panel}>
          <ScrollView bounces={false} contentContainerStyle={styles.panelContent}>
          <AppText variant="title">여행 기간 선택</AppText>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel="시작일 다시 선택" onPress={() => { setPhase("start"); setMonth(monthStart(start)); }} style={[styles.draft, phase === "start" && styles.activeDraft]}>
              <AppText variant="micro" color={colors.muted}>시작일</AppText><AppText variant="label">{label(start)}</AppText>
            </Pressable>
            <AppText color={colors.muted}>~</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="종료일 다시 선택" onPress={() => { setPhase("end"); setMonth(monthStart(end ?? start)); }} style={[styles.draft, phase === "end" && styles.activeDraft]}>
              <AppText variant="micro" color={colors.muted}>종료일</AppText><AppText variant="label">{end ? label(end) : "날짜를 선택하세요"}</AppText>
            </Pressable>
          </View>
          <AppText accessibilityLiveRegion="polite" variant="caption" color={colors.primary}>{phase === "start" ? "시작일을 선택해 주세요." : "종료일을 선택해 주세요. 시작일보다 앞선 날짜를 누르면 시작일이 바뀌어요."}</AppText>
          <View style={styles.monthHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => shiftMonth(-1)} style={styles.monthButton}><AppText>‹</AppText></Pressable>
            <AppText variant="heading">{year}년 {monthIndex + 1}월</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="다음 달" onPress={() => shiftMonth(1)} style={styles.monthButton}><AppText>›</AppText></Pressable>
          </View>
          <View style={styles.grid}>
            {weekdays.map((day) => <View key={day} style={styles.cell}><AppText variant="micro" color={colors.muted}>{day}</AppText></View>)}
            {Array.from({ length: cells }, (_, index) => {
              const day = index - offset + 1;
              if (day < 1 || day > count) return <View key={index} style={styles.cell} />;
              const date = iso(new Date(Date.UTC(year, monthIndex, day)));
              const endpoint = date === start || date === end;
              const within = end && date > start && date < end;
              return <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${date}${date === start ? " 시작일" : date === end ? " 종료일" : ""}`} accessibilityState={{ selected: Boolean(endpoint || within) }} onPress={() => select(date)} testID={`${testID}-day-${date}`} style={[styles.cell, within && styles.inRange, endpoint && styles.selected]}>
                <AppText color={endpoint ? colors.white : colors.ink}>{day}</AppText>
              </Pressable>;
            })}
          </View>
          <View style={styles.row}>
            <Button label="취소" variant="ghost" style={styles.action} onPress={() => setOpen(false)} />
            <Button label="기간 적용" testID={`${testID}-apply`} disabled={!end || end < start} style={styles.action} onPress={() => { if (end) { onChange({ startDate: start, endDate: end }); setOpen(false); } }} />
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  field: { minHeight: 72, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, padding: spacing.compact, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  endpoint: { flex: 1, gap: spacing.xs },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.45)", padding: spacing.md },
  panel: { width: "100%", maxWidth: 420, maxHeight: "100%", borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface },
  panelContent: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  draft: { flex: 1, minHeight: 64, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.sm },
  activeDraft: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.285714%", minHeight: 44, alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: colors.primary, borderRadius: radius.sm },
  inRange: { backgroundColor: colors.primarySoft },
  action: { flex: 1 },
});
