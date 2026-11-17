import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { router, useLocalSearchParams } from "expo-router";
import { Keyboard, Pressable, StyleSheet, TextInput } from "react-native";

import { colors, radius, spacing, fonts } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EditorialHeading } from "@/shared/ui/field-notes";
import { TripNavigation } from "@/shared/ui/trip-navigation";
import { Screen } from "@/shared/ui/screen";

import { PlaceSearchMap } from "./place-search-map";
import { useAddPlace } from "./use-add-place";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function AddPlacePage() {
  const params = useLocalSearchParams<{ tripId: string; query?: string | string[] }>();
  const tripId = params.tripId;
  const { hasUnsavedNotes, origin, bounds, setBounds, selected, setSelectedId, note, setNote, add, message, query, results, savedIds, savingId, search, searching, setQuery } = useAddPlace(tripId, first(params.query));

  useUnsavedChanges(hasUnsavedNotes, Boolean(savingId));
  const runSearch = () => { Keyboard.dismiss(); void search(); };

  return <Screen bottomSlot={<TripNavigation allowActiveNavigation tripId={tripId} active="places" />}>
    <EditorialHeading eyebrow="A PLACE TO REMEMBER" title="다음엔, 여기로." />
    <AppText color={colors.muted}>가고 싶은 장소를 검색해 이번 여행에 저장하세요.</AppText>
    <Card>
      <TextInput
        testID="add-place-query"
        editable={!savingId}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={runSearch}
        returnKeyType="search"
        placeholder="장소명, 음식점 또는 지역 검색"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Button label={searching ? "검색 중…" : "검색"} disabled={Boolean(savingId) || searching || query.trim().length < 2} testID="add-place-search" onPress={runSearch} />
    </Card>
    {message && <AppText accessibilityLiveRegion="polite" color={colors.secondary}>{message}</AppText>}
    {origin !== undefined && <PlaceSearchMap origin={origin} results={results} selectedId={selected?.googlePlaceId} onSelect={setSelectedId} onBoundsChange={setBounds} />}
    <AppText variant="caption" color={colors.muted}>지도를 이동한 뒤 검색하면 화면에 보이는 지역에서 장소를 찾아요.</AppText>
    <Button label={searching ? "검색 중…" : "이 지역에서 검색"} variant="secondary" testID="add-place-search-area"
      disabled={Boolean(savingId) || !bounds || searching || query.trim().length < 2} onPress={runSearch} />
    <Card>
      <AppText variant="heading">설명 추가 (선택)</AppText>
      <AppText variant="caption" color={colors.muted}>{selected ? `${selected.name}에 남길 내용을 적어 주세요.` : "검색 결과에서 장소를 선택하면 설명을 남길 수 있어요."}</AppText>
      <TextInput testID="add-place-note" accessibilityLabel="장소 설명 (선택)" editable={Boolean(selected) && !savingId}
        multiline value={note} onChangeText={setNote} placeholder="가고 싶은 이유, 추천 메뉴, 기억할 내용 등"
        placeholderTextColor={colors.muted} style={[styles.input, styles.note]} />
      {selected && <Button
        label={savedIds.has(selected.googlePlaceId) ? "추가됨" : savingId ? "추가 중…" : "이 여행에 추가"}
        disabled={Boolean(savingId) || searching || savedIds.has(selected.googlePlaceId)}
        testID={`add-place-${selected.googlePlaceId}`} onPress={() => void add(selected)} />}
    </Card>
    {results.map((candidate) => <Pressable key={candidate.googlePlaceId}
      testID={`add-place-select-${candidate.googlePlaceId}`} accessibilityRole="button"
      accessibilityLabel={`${candidate.name} 선택`} accessibilityState={{ selected: selected?.googlePlaceId === candidate.googlePlaceId }}
      disabled={Boolean(savingId)} onPress={() => setSelectedId(candidate.googlePlaceId)}>
      <Card style={selected?.googlePlaceId === candidate.googlePlaceId ? styles.selected : undefined}>
        <AppText variant="heading">{candidate.name}</AppText>
        {candidate.address && <AppText variant="caption" color={colors.muted}>{candidate.address}</AppText>}
        <AppText variant="caption" color={colors.primary}>{selected?.googlePlaceId === candidate.googlePlaceId ? "선택한 장소" : "이 장소 선택"}</AppText>
      </Card>
    </Pressable>)}
    <Button label="장소 보관함으로 돌아가기" variant="ghost" onPress={() => router.dismissTo(`/trips/${tripId}/places`)} />
  </Screen>;
}

const styles = StyleSheet.create({
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  note: { minHeight: 100, paddingVertical: spacing.sm, textAlignVertical: "top" },
  input: { fontFamily: fonts.sans,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
});
