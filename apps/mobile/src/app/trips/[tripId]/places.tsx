import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Screen } from "@/components/ui/screen";
import { colors, radius, spacing } from "@/design/tokens";
import { mockPlaces } from "@/mocks/trip";

export default function PlacesScreen() {
  const [added, setAdded] = useState(false);
  return (
    <Screen>
      <AppText variant="title">저장한 모든 장소</AppText>
      <AppText color={colors.muted}>일정 배치 여부와 관계없이 저장한 장소를 단순하게 모아봐요.</AppText>
      <Card><TextInput placeholder="장소 이름이나 링크 붙여넣기" placeholderTextColor={colors.muted} style={styles.input} /><Button label={added ? "저장했어요" : "장소 저장"} disabled={added} onPress={() => setAdded(true)} /></Card>
      {added && <Card><View style={styles.row}><AppText variant="heading">성수의 작은 카페</AppText><Pill label="새로 저장" selected /></View><AppText color={colors.muted}>카페 · 메모 없음</AppText></Card>}
      {mockPlaces.map((place) => <Card key={place.id}><View style={styles.row}><AppText variant="heading">{place.name}</AppText><Pill label={place.category} /></View><AppText color={colors.muted}>{place.note}</AppText></Card>)}
    </Screen>
  );
}
const styles = StyleSheet.create({ input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm } });
