import { useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { usePlaceLibrary } from "./use-place-library";

export default function PlacesScreen() {
  const { tripId, query: linkedQuery } = useLocalSearchParams<{ tripId: string; query?: string | string[] }>();
  const initialQuery = Array.isArray(linkedQuery) ? linkedQuery[0] : linkedQuery;
  const { editPlace, places, loading, saving, searching, message, query, results, reload, removePlace, saveCandidate, search, setQuery } = usePlaceLibrary(tripId, initialQuery);
  return (
    <Screen>
      <AppText variant="title">저장한 모든 장소</AppText>
      <AppText color={colors.muted}>일정 배치 여부와 관계없이 저장한 장소를 단순하게 모아봐요.</AppText>
      <Card>
        <TextInput testID="places-query" value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} returnKeyType="search" placeholder="예: 해운대 맛집" placeholderTextColor={colors.muted} style={styles.input} />
        <Button label={searching ? "검색 중…" : "장소 검색"} disabled={searching || query.trim().length < 2} testID="places-search" onPress={() => void search()} />
      </Card>
      {results.map((candidate) => <Card key={candidate.googlePlaceId}>
        <AppText variant="heading">{candidate.name}</AppText>
        <AppText color={colors.muted}>{candidate.address ?? "주소 정보 없음"}</AppText>
        <Button label={saving ? "저장 중…" : "장소 보관함에 저장"} disabled={saving} variant="secondary" testID={`places-save-${candidate.googlePlaceId}`} onPress={() => void saveCandidate(candidate)} />
      </Card>)}
      {message && <AppText color={colors.secondary}>{message}</AppText>}
      {loading && <Card><AppText color={colors.muted}>장소를 불러오는 중이에요…</AppText></Card>}
      {!loading && places.length === 0 && <Card><AppText variant="heading">아직 저장한 장소가 없어요</AppText><AppText color={colors.muted}>가고 싶은 장소를 먼저 저장해 보세요.</AppText></Card>}
      {places.map((place) => <Card key={place.id}>
        <View style={styles.row}><AppText variant="heading">{place.name}</AppText><Pill label={place.tag} /></View>
        <AppText color={colors.muted}>{place.note ?? place.address ?? "메모 없음"}</AppText>
        <View style={styles.preferences}>
          {([['must_visit', '꼭 가기'], ['want_to_visit', '가고 싶음'], ['if_time_allows', '시간 되면']] as const).map(([value, label]) => <Pill key={value} label={label} selected={place.preference === value} onPress={() => void editPlace(place.id, { preference: value })} />)}
        </View>
        <Button label="장소 삭제" variant="ghost" disabled={saving} onPress={() => Alert.alert("저장 장소를 삭제할까요?", "일정에 배치된 같은 장소도 함께 제거돼요.", [
          { text: "취소", style: "cancel" },
          { text: "삭제", style: "destructive", onPress: () => void removePlace(place.id) },
        ])} />
      </Card>)}
      {message && <Button label="다시 불러오기" variant="ghost" onPress={() => void reload()} />}
    </Screen>
  );
}
const styles = StyleSheet.create({ input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }, preferences: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs } });
