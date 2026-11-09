import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { savePlace, searchPlaces, type PlaceSearchCandidate, type SavedPlace } from "@/domains/places/api/places.api";
import { inferPlaceTag } from "@/domains/places/model/infer-place-tag";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import type { ItineraryItem } from "../../api/itineraries.api";

type DayPlacePickerProps = {
  tripId: string;
  date: string;
  dayIndex: number;
  items: ItineraryItem[];
  places: SavedPlace[];
  onApply: (date: string, selectedPlaceIds: string[], availablePlaces: SavedPlace[]) => void;
  onClose: () => void;
};

export function DayPlacePicker({ tripId, date, dayIndex, items, places, onApply, onClose }: DayPlacePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    const primaryLodgingId = places.find((place) => place.isPrimaryLodging)?.id;
    return new Set(items.filter((item) => item.date === date && item.savedPlaceId !== primaryLodgingId).map((item) => item.savedPlaceId));
  });
  const [tab, setTab] = useState<"unplaced" | "all">("unplaced");
  const [availablePlaces, setAvailablePlaces] = useState(places);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string>();
  const [message, setMessage] = useState<string>();

  const placedIds = new Set(items.map((item) => item.savedPlaceId));
  const selectablePlaces = availablePlaces.filter((place) => !place.isPrimaryLodging);
  const unplacedPlaces = selectablePlaces.filter((place) => !placedIds.has(place.id));
  const displayedPlaces = tab === "unplaced" ? unplacedPlaces : selectablePlaces;
  const toggle = (placeId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  };
  const search = async () => {
    const normalized = query.trim();
    if (normalized.length < 2) { setMessage("두 글자 이상 입력해 주세요."); return; }
    setSearching(true); setMessage(undefined);
    try {
      const candidates = await searchPlaces(tripId, normalized);
      setResults(candidates);
      if (candidates.length === 0) setMessage("검색 결과가 없어요.");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "장소를 검색하지 못했어요."); }
    finally { setSearching(false); }
  };
  const addNewPlace = async (candidate: PlaceSearchCandidate) => {
    setSavingId(candidate.googlePlaceId); setMessage(undefined);
    try {
      const result = await savePlace(tripId, {
        googlePlaceId: candidate.googlePlaceId,
        name: candidate.name,
        address: candidate.address ?? undefined,
        ...(candidate.latitude !== null && candidate.longitude !== null
          ? { latitude: candidate.latitude, longitude: candidate.longitude }
          : {}),
        tag: inferPlaceTag(candidate.primaryType ?? null),
        preference: "want_to_visit",
        isPrimaryLodging: false,
      });
      setAvailablePlaces((current) => current.some((place) => place.id === result.place.id) ? current : [...current, result.place]);
      setSelected((current) => new Set(current).add(result.place.id));
      setMessage(`${candidate.name}을(를) 저장하고 선택했어요.`);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "장소를 추가하지 못했어요."); }
    finally { setSavingId(undefined); }
  };

  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible>
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <AppText variant="title">Day {dayIndex + 1} 장소</AppText>
          <AppText color={colors.muted}>{date}</AppText>
        </View>
        <Button label="닫기" variant="ghost" onPress={onClose} style={styles.closeButton} />
      </View>
      <AppText color={colors.muted} style={styles.description}>미배치 장소를 고르거나 전체 장소에서 반복 방문할 장소를 추가하세요.</AppText>
      <View accessibilityRole="tablist" style={styles.tabs}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === "unplaced" }} onPress={() => setTab("unplaced")} style={[styles.tab, tab === "unplaced" && styles.tabSelected]} testID="itinerary-place-tab-unplaced">
          <AppText variant="label" color={tab === "unplaced" ? colors.primary : colors.muted}>미배치 · {unplacedPlaces.length}</AppText>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === "all" }} onPress={() => setTab("all")} style={[styles.tab, tab === "all" && styles.tabSelected]} testID="itinerary-place-tab-all">
          <AppText variant="label" color={tab === "all" ? colors.primary : colors.muted}>전체 장소 · {selectablePlaces.length}</AppText>
        </Pressable>
      </View>
      <View style={styles.searchSection}>
        <Button label={searchOpen ? "새 장소 검색 닫기" : "＋ 등록하지 않은 장소 검색"} variant="secondary" testID="itinerary-new-place-toggle" onPress={() => setSearchOpen((current) => !current)} />
        {searchOpen && <>
          <View style={styles.searchRow}>
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} placeholder="장소명, 음식점 또는 지역" placeholderTextColor={colors.muted} style={styles.searchInput} testID="itinerary-new-place-query" />
            <Button label={searching ? "검색 중…" : "검색"} disabled={searching || query.trim().length < 2} onPress={() => void search()} testID="itinerary-new-place-search" />
          </View>
          {message && <AppText color={colors.secondary}>{message}</AppText>}
          {results.map((candidate) => <View key={candidate.googlePlaceId} style={styles.result}>
            <View style={styles.placeText}><AppText variant="label">{candidate.name}</AppText><AppText variant="caption" color={colors.muted}>{candidate.address ?? "주소 정보 없음"}</AppText></View>
            <Button label={savingId === candidate.googlePlaceId ? "추가 중…" : "저장·선택"} disabled={Boolean(savingId)} variant="ghost" onPress={() => void addNewPlace(candidate)} testID={`itinerary-new-place-${candidate.googlePlaceId}`} />
          </View>)}
        </>}
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {displayedPlaces.length === 0 && <View style={styles.empty}>
          <AppText variant="heading">{selectablePlaces.length === 0 ? "저장한 여행 장소가 없어요" : "미배치 장소가 없어요"}</AppText>
          <AppText color={colors.muted}>{selectablePlaces.length === 0 ? "위의 검색으로 새 장소를 바로 추가해 보세요." : "전체 장소 탭에서 이미 배치한 장소를 다시 추가할 수 있어요."}</AppText>
        </View>}
        {displayedPlaces.map((place) => {
          const placedOnAnotherDay = items.some((item) => item.savedPlaceId === place.id && item.date !== date);
          const checked = selected.has(place.id);
          return <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            key={place.id}
            onPress={() => toggle(place.id)}
            style={[styles.place, checked && styles.placeSelected]}
            testID={`itinerary-place-option-${place.id}`}
          >
            <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
              {checked && <AppText color={colors.white}>✓</AppText>}
            </View>
            <View style={styles.placeText}>
              <AppText variant="label">{place.name}</AppText>
              {place.address && <AppText variant="caption" color={colors.muted}>{place.address}</AppText>}
              {placedOnAnotherDay && <AppText variant="caption" color={colors.secondary}>다른 날짜에도 배치된 장소예요.</AppText>}
            </View>
          </Pressable>;
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={`${selected.size}곳 선택 적용`} testID="itinerary-place-picker-apply" onPress={() => { onApply(date, [...selected], availablePlaces); onClose(); }} />
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  heading: { flex: 1, gap: spacing.xs },
  closeButton: { minHeight: 44, paddingHorizontal: spacing.md },
  description: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  tab: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  tabSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  searchSection: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  searchInput: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface },
  result: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface, padding: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  empty: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, gap: spacing.sm },
  place: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  placeSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  checkbox: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  placeText: { flex: 1, gap: spacing.xs },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
});
