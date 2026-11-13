import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, TextInput } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";

import { useAddPlace } from "./use-add-place";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function AddPlacePage() {
  const params = useLocalSearchParams<{ tripId: string; query?: string | string[] }>();
  const tripId = params.tripId;
  const { add, message, query, results, savedIds, savingId, search, searching, setQuery } = useAddPlace(tripId, first(params.query));

  return <Screen>
    <AppText variant="title">장소 추가</AppText>
    <AppText color={colors.muted}>가고 싶은 장소를 검색해 이번 여행에 저장하세요.</AppText>
    <Card>
      <TextInput
        autoFocus
        testID="add-place-query"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => void search()}
        returnKeyType="search"
        placeholder="장소명, 음식점 또는 지역 검색"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Button label={searching ? "검색 중…" : "검색"} disabled={searching || query.trim().length < 2} testID="add-place-search" onPress={() => void search()} />
    </Card>
    {message && <AppText accessibilityLiveRegion="polite" color={colors.secondary}>{message}</AppText>}
    {results.map((candidate) => {
      const saved = savedIds.has(candidate.googlePlaceId);
      const saving = savingId === candidate.googlePlaceId;
      return <Card key={candidate.googlePlaceId}>
        <AppText variant="heading">{candidate.name}</AppText>
        <Button
          label={saved ? "추가됨" : saving ? "추가 중…" : "이 여행에 추가"}
          disabled={Boolean(savingId) || saved}
          variant="secondary"
          testID={`add-place-${candidate.googlePlaceId}`}
          onPress={() => void add(candidate)}
        />
      </Card>;
    })}
    <Button label="장소 보관함으로 돌아가기" variant="ghost" onPress={() => router.replace(`/trips/${tripId}/places`)} />
  </Screen>;
}

const styles = StyleSheet.create({
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
});
