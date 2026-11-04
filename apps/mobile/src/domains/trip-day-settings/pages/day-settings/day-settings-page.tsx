import { useLocalSearchParams } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { useDaySettings } from "./use-day-settings";

export default function DaySettingsPage() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { loading, lodgings, message, reload, save, saving, settings, update } = useDaySettings(tripId);
  return <Screen>
    <AppText variant="title">숙소와 날짜 설정</AppText>
    <AppText color={colors.muted}>날짜마다 활동 시간과 출발·종료 숙소를 정하면 AI가 이동 흐름에 반영해요.</AppText>
    {loading && <Card><AppText color={colors.muted}>설정을 불러오는 중이에요…</AppText></Card>}
    {!loading && lodgings.length === 0 && <Card>
      <AppText variant="heading">저장한 숙소가 없어요</AppText>
      <AppText color={colors.muted}>장소 보관함에서 숙소 태그로 장소를 저장하면 출발·종료 위치로 선택할 수 있어요.</AppText>
    </Card>}
    {settings.map((setting) => <Card key={setting.date}>
      <AppText variant="heading">{setting.date}</AppText>
      <View style={styles.timeRow}>
        <View style={styles.timeField}><AppText variant="label">시작</AppText><TextInput value={setting.startTime} onChangeText={(startTime) => update(setting.date, { startTime })} placeholder="09:00" style={styles.input} /></View>
        <View style={styles.timeField}><AppText variant="label">종료</AppText><TextInput value={setting.endTime} onChangeText={(endTime) => update(setting.date, { endTime })} placeholder="21:00" style={styles.input} /></View>
      </View>
      <AppText variant="label">출발 숙소</AppText>
      <View style={styles.pills}><Pill label="지정 안 함" selected={!setting.startPlaceId} onPress={() => update(setting.date, { startPlaceId: null })} />{lodgings.map((place) => <Pill key={`start-${place.id}`} label={place.name} selected={setting.startPlaceId === place.id} onPress={() => update(setting.date, { startPlaceId: place.id })} />)}</View>
      <AppText variant="label">종료 숙소</AppText>
      <View style={styles.pills}><Pill label="지정 안 함" selected={!setting.endPlaceId} onPress={() => update(setting.date, { endPlaceId: null })} />{lodgings.map((place) => <Pill key={`end-${place.id}`} label={place.name} selected={setting.endPlaceId === place.id} onPress={() => update(setting.date, { endPlaceId: place.id })} />)}</View>
    </Card>)}
    {message && <AppText color={colors.secondary}>{message}</AppText>}
    <Button label={saving ? "저장 중…" : "날짜 설정 저장"} disabled={loading || saving || settings.length === 0} onPress={() => void save()} />
    {message && <Button label="다시 불러오기" variant="ghost" onPress={() => void reload()} />}
  </Screen>;
}

const styles = StyleSheet.create({
  timeRow: { flexDirection: "row", gap: spacing.sm },
  timeField: { flex: 1, gap: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.ink },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
