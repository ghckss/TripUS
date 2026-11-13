import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { searchCities, searchPlacesByDestination, type PlaceSearchCandidate } from "@/domains/places/api/places.api";
import type { TravelCountry } from "@/domains/trips/components/country-options";
import { safeErrorMessage } from "@/shared/api/trip-us-api";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";

export type SelectedRegion = {
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

type RegionMultiSelectProps = {
  country: TravelCountry;
  value: SelectedRegion[];
  onChange: (regions: SelectedRegion[]) => void;
};

const MAX_REGIONS = 10;
const CITY_TYPES = new Set(["locality", "administrative_area_level_1", "administrative_area_level_2"]);

export function RegionMultiSelect({ country, value, onChange }: RegionMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [draftRegions, setDraftRegions] = useState<SelectedRegion[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<string>();

  const loadCities = async (searchQuery = "주요 도시") => {
    setSearching(true);
    setMessage(undefined);
    try {
      const candidates = await searchCities(country.name, country.code, searchQuery);
      const options = candidates.filter((candidate) => !candidate.primaryType || CITY_TYPES.has(candidate.primaryType));
      setResults(options);
      if (options.length === 0) setMessage("선택할 도시가 없어요. 도시 이름으로 다시 검색해 주세요.");
    } catch (caught) {
      setMessage(safeErrorMessage(caught, "도시 목록을 불러오지 못했어요."));
    } finally {
      setSearching(false);
    }
  };

  const showDropdown = () => {
    setDraftRegions(value);
    setOpen(true);
    setQuery("");
    void loadCities();
  };

  const search = () => void loadCities(query.trim() || "주요 도시");

  const select = async (candidate: PlaceSearchCandidate) => {
    const selected = draftRegions.find((region) =>
      region.googlePlaceId === candidate.googlePlaceId
      || region.name.toLocaleLowerCase() === candidate.name.toLocaleLowerCase(),
    );
    if (selected) {
      setDraftRegions((current) => current.filter((region) => region !== selected));
      setMessage(undefined);
      return;
    }
    if (draftRegions.length >= MAX_REGIONS) {
      setMessage(`도시는 최대 ${MAX_REGIONS}개까지 선택할 수 있어요.`);
      return;
    }
    setResolving(true);
    let resolved = candidate;
    try {
      const matches = await searchPlacesByDestination(country.name, candidate.name);
      resolved = matches.find((item) => item.primaryType === "locality") ?? matches[0] ?? candidate;
    } catch {
      // The catalog selection remains usable even if Google detail enrichment is temporarily unavailable.
    }
    setDraftRegions((current) => [...current, {
      googlePlaceId: resolved.googlePlaceId.startsWith("catalog:") ? null : resolved.googlePlaceId,
      name: resolved.name,
      address: resolved.address ?? candidate.address ?? null,
      latitude: resolved.latitude ?? null,
      longitude: resolved.longitude ?? null,
    }]);
    setResolving(false);
    setMessage(undefined);
  };

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setMessage(undefined);
  };

  const apply = () => {
    onChange(draftRegions);
    close();
  };

  return <View style={styles.container}>
    <AppText variant="heading">도시·지역</AppText>
    <AppText color={colors.muted}>{country.name}의 도시를 최대 {MAX_REGIONS}개까지 선택할 수 있어요.</AppText>
    {value.map((region) => <View key={region.googlePlaceId ?? `${region.name}-${region.address}`} style={styles.selected}>
      <View style={styles.selectedText}>
        <AppText variant="label">{region.name}</AppText>
        {region.address && <AppText variant="caption" color={colors.muted}>{region.address}</AppText>}
      </View>
      <Pressable
        accessibilityLabel={`${region.name} 지역 삭제`}
        accessibilityRole="button"
        onPress={() => onChange(value.filter((item) => item !== region))}
        style={styles.remove}
        testID={`region-remove-${region.googlePlaceId ?? region.name}`}
      >
        <AppText color={colors.danger}>삭제</AppText>
      </Pressable>
    </View>)}
    <Pressable
      accessibilityLabel={`${country.name} 도시 선택`}
      accessibilityRole="button"
      disabled={value.length >= MAX_REGIONS}
      onPress={showDropdown}
      style={styles.dropdown}
      testID="region-dropdown-open"
    >
      <AppText color={value.length >= MAX_REGIONS ? colors.muted : colors.ink}>
        {value.length >= MAX_REGIONS ? "도시를 모두 선택했어요" : "도시를 선택해 주세요"}
      </AppText>
      <AppText color={colors.muted}>⌄</AppText>
    </Pressable>

    <Modal animationType="slide" presentationStyle="pageSheet" visible={open} onRequestClose={close}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.header}>
          <AppText variant="title" style={styles.headerTitle}>{country.flag} {country.name} 도시 선택</AppText>
          <Button label="닫기" variant="ghost" onPress={close} />
        </View>
        <AppText color={colors.muted}>여러 도시를 선택한 뒤 한 번에 적용할 수 있어요.</AppText>
        {draftRegions.length > 0 && <View style={styles.draftRegions}>
          {draftRegions.map((region) => <Pressable
            accessibilityLabel={`${region.name} 선택 해제`}
            accessibilityRole="button"
            key={region.googlePlaceId ?? `${region.name}-${region.address}`}
            onPress={() => setDraftRegions((current) => current.filter((item) => item !== region))}
            style={styles.draftRegion}
          >
            <AppText variant="label" color={colors.primary}>{region.name} ×</AppText>
          </Pressable>)}
        </View>}
        <View style={styles.searchRow}>
          <TextInput
            autoCorrect={false}
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="도시 이름으로 목록 검색"
            returnKeyType="search"
            style={styles.input}
            testID="region-search-input"
            value={query}
          />
          <Button label={searching ? "검색 중…" : "검색"} disabled={searching} onPress={search} testID="region-search-button" />
        </View>
        {message && <AppText color={colors.muted}>{message}</AppText>}
        <FlatList
          data={results}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.googlePlaceId}
          ListEmptyComponent={!searching ? <AppText color={colors.muted}>표시할 도시가 없어요.</AppText> : undefined}
          renderItem={({ item }) => {
            const selected = draftRegions.some((region) =>
              region.googlePlaceId === item.googlePlaceId
              || region.name.toLocaleLowerCase() === item.name.toLocaleLowerCase(),
            );
            return <Pressable
            accessibilityLabel={`${item.name} 도시 선택`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            disabled={resolving}
            onPress={() => void select(item)}
            style={[styles.result, selected && styles.selectedResult]}
            testID={`region-result-${item.googlePlaceId}`}
          >
            <AppText>📍</AppText>
            <View style={styles.resultText}>
              <AppText variant="label">{item.name}</AppText>
              {item.address && <AppText variant="caption" color={colors.muted}>{item.address}</AppText>}
            </View>
            <AppText color={selected ? colors.danger : colors.primary}>{resolving ? "확인 중…" : selected ? "해제" : "선택"}</AppText>
          </Pressable>}}
          ListFooterComponent={<AppText variant="caption" color={colors.muted} style={styles.attribution}>도시 데이터: GeoNames (CC BY 4.0)</AppText>}
        />
        <Button label={`${draftRegions.length}개 도시 적용`} disabled={resolving} testID="region-selection-apply" onPress={apply} />
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, marginTop: spacing.md },
  selected: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  selectedText: { flex: 1, gap: spacing.xs },
  remove: { minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.sm },
  dropdown: { minHeight: 54, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modal: { flex: 1, backgroundColor: colors.canvas, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  headerTitle: { flex: 1, flexShrink: 1 },
  draftRegions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  draftRegion: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink },
  result: { minHeight: 68, borderBottomWidth: 1, borderBottomColor: colors.line, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  resultText: { flex: 1, gap: spacing.xs },
  selectedResult: { backgroundColor: colors.primarySoft, borderRadius: radius.sm },
  attribution: { padding: spacing.md, textAlign: "center" },
});
