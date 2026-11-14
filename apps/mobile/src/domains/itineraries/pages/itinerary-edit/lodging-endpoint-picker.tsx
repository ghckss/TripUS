import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { savePlace, searchPlaces, updatePlace, type PlaceSearchCandidate, type SavedPlace } from "@/domains/places/api/places.api";
import { safeErrorMessage } from "@/shared/api/trip-us-api";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { KeyboardAvoidingContainer } from "@/shared/ui/keyboard-avoiding-container";
import { isLodgingPlace, type LodgingEdge } from "./itinerary-lodging-endpoints";

type Props = {
  current: SavedPlace;
  date: string;
  dayIndex: number;
  edge: LodgingEdge;
  places: SavedPlace[];
  tripId: string;
  onApply: (place: SavedPlace, availablePlaces: SavedPlace[]) => void;
  onClose: () => void;
};

export function LodgingEndpointPicker({ current, date, dayIndex, edge, places, tripId, onApply, onClose }: Props) {
  const [availablePlaces, setAvailablePlaces] = useState(places);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const edgeLabel = edge === "start" ? "시작 숙소" : "마지막 숙소";
  const savedLodgings = availablePlaces.filter(isLodgingPlace);

  const apply = (place: SavedPlace, nextPlaces = availablePlaces) => {
    onApply(place, nextPlaces);
    onClose();
  };

  const search = async () => {
    const normalized = query.trim();
    if (normalized.length < 2) { setMessage("숙소 이름을 두 글자 이상 입력해 주세요."); return; }
    setSearching(true); setMessage(undefined);
    try {
      const candidates = await searchPlaces(tripId, normalized);
      setResults(candidates);
      if (candidates.length === 0) setMessage("검색 결과가 없어요.");
    } catch (caught) { setMessage(safeErrorMessage(caught, "숙소를 검색하지 못했어요.")); }
    finally { setSearching(false); }
  };

  const saveAndApply = async (candidate: PlaceSearchCandidate) => {
    setSavingId(candidate.googlePlaceId); setMessage(undefined);
    try {
      const result = await savePlace(tripId, {
        googlePlaceId: candidate.googlePlaceId,
        name: candidate.name,
        address: candidate.address ?? undefined,
        ...(candidate.latitude != null && candidate.longitude != null
          ? { latitude: candidate.latitude, longitude: candidate.longitude }
          : {}),
        tag: "lodging",
        preference: "want_to_visit",
        isPrimaryLodging: false,
      });
      const lodging = isLodgingPlace(result.place)
        ? result.place
        : await updatePlace(tripId, result.place.id, { tag: "lodging", isPrimaryLodging: false });
      const nextPlaces = availablePlaces.some((place) => place.id === lodging.id)
        ? availablePlaces.map((place) => place.id === lodging.id ? lodging : place)
        : [lodging, ...availablePlaces];
      setAvailablePlaces(nextPlaces);
      apply(lodging, nextPlaces);
    } catch (caught) { setMessage(safeErrorMessage(caught, "숙소를 저장하지 못했어요.")); }
    finally { setSavingId(undefined); }
  };

  return <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible>
    <KeyboardAvoidingContainer><SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <AppText variant="title">Day {dayIndex + 1} {edgeLabel}</AppText>
          <AppText color={colors.muted}>{date}</AppText>
        </View>
        <Button label="닫기" variant="ghost" onPress={onClose} style={styles.closeButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.current}>
          <AppText variant="caption" color={colors.muted}>현재 {edgeLabel}</AppText>
          <AppText variant="heading">{current.name}</AppText>
          {current.address && <AppText color={colors.muted}>{current.address}</AppText>}
        </Card>

        <View style={styles.section}>
          <AppText variant="heading">저장된 숙소</AppText>
          {savedLodgings.map((place) => <Pressable
            accessibilityLabel={`${place.name}을(를) ${edgeLabel}로 선택`}
            accessibilityRole="button"
            disabled={place.id === current.id}
            key={place.id}
            onPress={() => apply(place)}
            style={[styles.place, place.id === current.id && styles.selectedPlace]}
            testID={`lodging-endpoint-option-${place.id}`}
          >
            <View style={styles.placeText}>
              <AppText variant="label">{place.name}</AppText>
              {place.address && <AppText variant="caption" color={colors.muted}>{place.address}</AppText>}
            </View>
            <AppText color={place.id === current.id ? colors.muted : colors.primary}>{place.id === current.id ? "현재" : "선택"}</AppText>
          </Pressable>)}
        </View>

        <View style={styles.section}>
          <AppText variant="heading">다른 숙소 검색</AppText>
          <View style={styles.searchRow}>
            <TextInput
              autoCorrect={false}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              placeholder="숙소 이름 검색"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.input}
              testID="lodging-endpoint-search-input"
              value={query}
            />
            <Button label={searching ? "검색 중…" : "검색"} disabled={searching} onPress={() => void search()} testID="lodging-endpoint-search" />
          </View>
          {message && <AppText color={colors.secondary}>{message}</AppText>}
          {results.map((candidate) => <Pressable
            accessibilityLabel={`${candidate.name}을(를) ${edgeLabel}로 저장하고 선택`}
            accessibilityRole="button"
            disabled={Boolean(savingId)}
            key={candidate.googlePlaceId}
            onPress={() => void saveAndApply(candidate)}
            style={styles.place}
            testID={`lodging-endpoint-result-${candidate.googlePlaceId}`}
          >
            <View style={styles.placeText}>
              <AppText variant="label">{candidate.name}</AppText>
              {candidate.address && <AppText variant="caption" color={colors.muted}>{candidate.address}</AppText>}
            </View>
            <AppText color={colors.primary}>{savingId === candidate.googlePlaceId ? "저장 중…" : "변경"}</AppText>
          </Pressable>)}
        </View>
      </ScrollView>
    </SafeAreaView></KeyboardAvoidingContainer>
  </Modal>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  heading: { flex: 1, gap: spacing.xs },
  closeButton: { minHeight: 44, paddingHorizontal: spacing.md },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  current: { backgroundColor: colors.primarySoft },
  section: { gap: spacing.sm },
  place: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  selectedPlace: { backgroundColor: colors.canvas },
  placeText: { flex: 1, gap: spacing.xs },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.ink },
});
