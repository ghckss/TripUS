import { useLocalSearchParams } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { usePlaceLibrary } from "./use-place-library";

export default function PlacesScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { places, loading, saving, message, reload, addMockPlace } = usePlaceLibrary(tripId);
  return (
    <Screen>
      <AppText variant="title">저장한 모든 장소</AppText>
      <AppText color={colors.muted}>일정 배치 여부와 관계없이 저장한 장소를 단순하게 모아봐요.</AppText>
      <Card><TextInput editable={false} placeholder="장소 검색은 다음 단계에서 연결합니다" placeholderTextColor={colors.muted} style={styles.input} /><Button label={saving ? "저장 중…" : "목업 장소 저장"} disabled={saving} onPress={() => void addMockPlace()} /></Card>
      {message && <AppText color={colors.secondary}>{message}</AppText>}
      {loading && <Card><AppText color={colors.muted}>장소를 불러오는 중이에요…</AppText></Card>}
      {!loading && places.length === 0 && <Card><AppText variant="heading">아직 저장한 장소가 없어요</AppText><AppText color={colors.muted}>가고 싶은 장소를 먼저 저장해 보세요.</AppText></Card>}
      {places.map((place) => <Card key={place.id}><View style={styles.row}><AppText variant="heading">{place.name}</AppText><Pill label={place.tag} /></View><AppText color={colors.muted}>{place.note ?? place.address ?? "메모 없음"}</AppText></Card>)}
      {message && <Button label="다시 불러오기" variant="ghost" onPress={() => void reload()} />}
    </Screen>
  );
}
const styles = StyleSheet.create({ input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm } });
