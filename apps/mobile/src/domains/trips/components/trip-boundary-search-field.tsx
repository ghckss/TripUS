import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { searchPlacesByDestination, type PlaceSearchCandidate } from "@/domains/places/api/places.api";
import { safeErrorMessage } from "@/shared/api/trip-us-api";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { TimeField } from "@/domains/trips/components/time-field";

export type SelectedBoundaryPoint = {
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  time: string | null;
};

export function isBoundaryPointValid(point?: SelectedBoundaryPoint): boolean {
  return !point?.time || /^([01]\d|2[0-3]):[0-5]\d$/.test(point.time);
}

type TripBoundarySearchFieldProps = {
  destination: string;
  kind: "start" | "end";
  value?: SelectedBoundaryPoint;
  onChange: (point: SelectedBoundaryPoint | undefined) => void;
};

export function TripBoundarySearchField({ destination, kind, value, onChange }: TripBoundarySearchFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string>();
  const [editing, setEditing] = useState(false);
  const isStart = kind === "start";
  const title = isStart ? "여행 시작 지점" : "여행 종료 지점";

  const search = async () => {
    if (query.trim().length < 2) {
      setMessage("장소 이름을 2자 이상 입력해 주세요.");
      return;
    }
    setSearching(true);
    setMessage(undefined);
    try {
      const candidates = await searchPlacesByDestination(destination, query.trim());
      setResults(candidates);
      if (candidates.length === 0) setMessage("검색 결과가 없어요. 다른 이름으로 검색해 주세요.");
    } catch (caught) {
      setMessage(safeErrorMessage(caught, "장소를 검색하지 못했어요."));
    } finally {
      setSearching(false);
    }
  };

  const select = (candidate: PlaceSearchCandidate) => {
    onChange({
      googlePlaceId: candidate.googlePlaceId,
      name: candidate.name,
      address: candidate.address ?? null,
      latitude: candidate.latitude ?? null,
      longitude: candidate.longitude ?? null,
      time: value?.time ?? null,
    });
    setResults([]);
    setQuery("");
    setEditing(false);
  };

  const toggleEditing = () => {
    if (editing) {
      setQuery("");
      setResults([]);
      setMessage(undefined);
    }
    setEditing((current) => !current);
  };

  return <View style={styles.container}>
    <AppText variant="heading">{title} <AppText color={colors.muted}>(선택)</AppText></AppText>
    <AppText color={colors.muted}>{isStart ? "첫날 이 장소에서 일정을 시작해요." : "마지막 날 이 장소에서 일정을 마쳐요."}</AppText>
    {value && <Card style={styles.selected}>
      <View style={styles.selectedHeader}>
        <View style={styles.selectedText}>
          <AppText variant="label">{value.name}</AppText>
        </View>
        <Button label={editing ? "취소" : "수정"} variant="ghost" testID={`trip-${kind}-point-edit`} onPress={toggleEditing} />
      </View>
      <TimeField
        label={isStart ? "일정 시작 가능 시각" : "이 지점에 도착해야 하는 시각"}
        value={value.time}
        onChange={(time) => onChange({ ...value, time })}
        testID={`trip-${kind}-point-time`}
      />
    </Card>}
    {(!value || editing) && <><View style={styles.searchRow}>
      <TextInput
        autoCorrect={false}
        onChangeText={setQuery}
        onSubmitEditing={() => void search()}
        placeholder={isStart ? "공항·역·집·출발 장소 검색" : "공항·역·도착 장소 검색"}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={styles.searchInput}
        testID={`trip-${kind}-point-search-input`}
        value={query}
      />
      <Button label={searching ? "검색 중…" : "검색"} disabled={searching} onPress={() => void search()} testID={`trip-${kind}-point-search-button`} />
    </View>
    {message && <AppText color={colors.muted}>{message}</AppText>}
    {results.map((candidate) => <Pressable
      accessibilityLabel={`${candidate.name} ${title} 선택`}
      accessibilityRole="button"
      key={candidate.googlePlaceId}
      onPress={() => select(candidate)}
      style={styles.result}
      testID={`trip-${kind}-point-result-${candidate.googlePlaceId}`}
    >
      <AppText>📍</AppText>
      <View style={styles.resultText}>
        <AppText variant="label">{candidate.name}</AppText>
      </View>
      <AppText color={colors.primary}>선택</AppText>
    </Pressable>)}</>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, marginTop: spacing.md },
  result: { minHeight: 68, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  resultText: { flex: 1, gap: spacing.xs },
  searchInput: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  selected: { backgroundColor: colors.primarySoft },
  selectedHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  selectedText: { flex: 1, gap: spacing.xs },
});
