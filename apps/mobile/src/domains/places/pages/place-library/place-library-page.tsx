import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { usePlaceLibrary } from "./use-place-library";

export default function PlacesScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const {
    clearSelection, editPlace, places, loading, saving, message, reload,
    removePlaces, selectAll, selectedIds, toggleSelection,
  } = usePlaceLibrary(tripId);
  const selectedCount = selectedIds.size;

  const confirmSelectedRemoval = () => Alert.alert(
    `선택한 ${selectedCount}개 장소를 삭제할까요?`,
    "일정에 배치된 장소도 함께 제거돼요.",
    [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => void removePlaces([...selectedIds]) },
    ],
  );
  const confirmAllRemoval = () => Alert.alert(
    "저장 장소를 모두 삭제할까요?",
    `현재 목록의 ${places.length}개 장소와 일정 배치가 함께 제거돼요. 이 작업은 되돌릴 수 없어요.`,
    [
      { text: "취소", style: "cancel" },
      {
        text: "전체 삭제",
        style: "destructive",
        onPress: () => void removePlaces(places.map((place) => place.id)),
      },
    ],
  );
  return (
    <Screen>
      <AppText variant="title">저장한 모든 장소</AppText>
      <AppText color={colors.muted}>일정 배치 여부와 관계없이 저장한 장소를 단순하게 모아봐요.</AppText>
      <Button label="＋ 장소 추가" testID="places-add" onPress={() => router.push(`/trips/${tripId}/places/new`)} />
      {!loading && places.length > 0 && <Card>
        <View style={styles.selectionSummary}>
          <AppText variant="label">{selectedCount}개 선택됨</AppText>
          <Pressable accessibilityRole="button" onPress={selectedCount === places.length ? clearSelection : selectAll}>
            <AppText variant="label" color={colors.primary}>{selectedCount === places.length ? "전체 선택 해제" : "전체 선택"}</AppText>
          </Pressable>
        </View>
        <View style={styles.managementActions}>
          <Button label={`선택 장소 제거${selectedCount > 0 ? ` (${selectedCount})` : ""}`} variant="danger" disabled={saving || selectedCount === 0} style={styles.actionButton} onPress={confirmSelectedRemoval} />
          <Button label="전체 제거" variant="ghost" disabled={saving} style={styles.actionButton} onPress={confirmAllRemoval} />
        </View>
      </Card>}
      {message && <AppText color={colors.secondary}>{message}</AppText>}
      {loading && <Card><AppText color={colors.muted}>장소를 불러오는 중이에요…</AppText></Card>}
      {!loading && places.length === 0 && <Card><AppText variant="heading">아직 저장한 장소가 없어요</AppText><AppText color={colors.muted}>가고 싶은 장소를 먼저 저장해 보세요.</AppText></Card>}
      {places.map((place) => <Card key={place.id}>
        <View style={styles.row}>
          <View style={styles.titleRow}>
            <Pressable
              accessibilityLabel={`${place.name} 선택`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selectedIds.has(place.id) }}
              hitSlop={8}
              onPress={() => toggleSelection(place.id)}
              style={[styles.checkbox, selectedIds.has(place.id) && styles.checkboxSelected]}
            >
              {selectedIds.has(place.id) && <AppText variant="label" color={colors.white}>✓</AppText>}
            </Pressable>
            <AppText variant="heading" style={styles.placeName}>{place.name}</AppText>
          </View>
          <Pill label={place.tag} />
        </View>
        <AppText color={colors.muted}>{place.note ?? place.address ?? "메모 없음"}</AppText>
        <View style={styles.preferences}>
          {([['must_visit', '꼭 가기'], ['want_to_visit', '가고 싶음'], ['if_time_allows', '시간 되면']] as const).map(([value, label]) => <Pill key={value} label={label} selected={place.preference === value} onPress={() => void editPlace(place.id, { preference: value })} />)}
        </View>
      </Card>)}
      {message && <Button label="다시 불러오기" variant="ghost" onPress={() => void reload()} />}
    </Screen>
  );
}
const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  checkbox: { width: 28, height: 28, borderWidth: 2, borderColor: colors.line, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  managementActions: { flexDirection: "row", gap: spacing.sm },
  placeName: { flexShrink: 1 },
  preferences: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  selectionSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
