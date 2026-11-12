import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { searchPlacesByDestination, type PlaceSearchCandidate } from "@/domains/places/api/places.api";
import { safeErrorMessage } from "@/shared/api/trip-us-api";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export type SelectedLodging = {
  googlePlaceId?: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type LodgingSearchFieldProps = {
  destination: string;
  value?: SelectedLodging;
  onChange: (lodging: SelectedLodging | undefined) => void;
};

export function LodgingSearchField({ destination, value, onChange }: LodgingSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string>();

  const search = async () => {
    if (query.trim().length < 2) {
      setMessage("숙소 이름을 2자 이상 입력해 주세요.");
      return;
    }
    setSearching(true);
    setMessage(undefined);
    try {
      const candidates = await searchPlacesByDestination(destination, query.trim());
      setResults(candidates);
      if (candidates.length === 0) setMessage("검색 결과가 없어요. 다른 이름으로 검색해 주세요.");
    } catch (caught) {
      setMessage(safeErrorMessage(caught, "숙소를 검색하지 못했어요."));
    } finally {
      setSearching(false);
    }
  };

  return <View style={styles.container}>
    <AppText variant="heading">기본 숙소</AppText>
    <AppText color={colors.muted}>지도 검색 결과에서 선택하세요. 숙소는 첫날 종료부터 마지막 날 시작까지 자동 연결돼요.</AppText>
    {value && <Card style={styles.selected}>
      <AppText variant="label">선택한 숙소</AppText>
      <AppText variant="heading">{value.name}</AppText>
      {value.address && <AppText color={colors.muted}>{value.address}</AppText>}
    </Card>}
    <View style={styles.searchRow}>
      <TextInput
        autoCorrect={false}
        onChangeText={setQuery}
        onSubmitEditing={() => void search()}
        placeholder={`${destination} 숙소 검색`}
        returnKeyType="search"
        style={styles.input}
        testID="lodging-search-input"
        value={query}
      />
      <Button label={searching ? "검색 중…" : "검색"} disabled={searching} onPress={() => void search()} testID="lodging-search-button" />
    </View>
    {message && <AppText color={colors.muted}>{message}</AppText>}
    {results.map((candidate) => <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${candidate.name} 숙소 선택`}
      key={candidate.googlePlaceId}
      onPress={() => { onChange(candidate); setResults([]); setQuery(""); }}
      style={styles.result}
    >
      <AppText>📍</AppText>
      <View style={styles.resultText}>
        <AppText variant="label">{candidate.name}</AppText>
        {candidate.address && <AppText variant="caption" color={colors.muted}>{candidate.address}</AppText>}
      </View>
      <AppText color={colors.primary}>선택</AppText>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, marginTop: spacing.md },
  selected: { backgroundColor: colors.primarySoft },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink },
  result: { minHeight: 68, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  resultText: { flex: 1, gap: spacing.xs },
});
