import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { getPlacePhoto, type PlacePhoto } from "@/domains/places/api/places.api";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { colors, spacing } from "@/shared/design/tokens";
import { usePlaceLibrary } from "./use-place-library";
import { useAppDialog } from "@/shared/ui/app-dialog";

export default function PlacesScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const {
    clearSelection, places, loading, saving, message, reload,
    removePlaces, selectPlaces, selectedIds, toggleSelection,
  } = usePlaceLibrary(tripId);
  const { showDialog } = useAppDialog();
  const selectedCount = selectedIds.size;
  const [activeTag, setActiveTag] = useState<string>("all");
  const tags = useMemo(() => [...new Set(places.map((place) => place.tag))].sort(), [places]);
  const effectiveTag = activeTag === "all" || tags.some((tag) => tag === activeTag) ? activeTag : "all";
  const filteredPlaces = effectiveTag === "all" ? places : places.filter((place) => place.tag === effectiveTag);
  const allFilteredSelected = filteredPlaces.length > 0 && filteredPlaces.every((place) => selectedIds.has(place.id));

  const changeTag = (tag: string) => {
    setActiveTag(tag);
    clearSelection();
  };

  const confirmSelectedRemoval = () => showDialog({
    title: `선택한 ${selectedCount}개 장소를 삭제할까요?`,
    message: "일정에 배치된 장소도 함께 제거돼요.",
    actions: [
      { label: "취소", variant: "ghost" },
      { label: "삭제", variant: "danger", onPress: () => void removePlaces([...selectedIds]) },
    ],
  });
  const confirmAllRemoval = () => showDialog({
    title: "저장 장소를 모두 삭제할까요?",
    message: `현재 목록의 ${places.length}개 장소와 일정 배치가 함께 제거돼요. 이 작업은 되돌릴 수 없어요.`,
    actions: [
      { label: "취소", variant: "ghost" },
      { label: "전체 삭제", variant: "danger", onPress: () => void removePlaces(places.map((place) => place.id)) },
    ],
  });
  return (
    <Screen stickyHeaderIndices={[1]}>
      <View style={styles.header}>
        <AppText variant="title">저장한 모든 장소</AppText>
        <AppText color={colors.muted}>일정 배치 여부와 관계없이 저장한 장소를 단순하게 모아봐요.</AppText>
      </View>
      <View style={styles.stickyAction}>
        <Button label="＋ 장소 추가" testID="places-add" onPress={() => router.push(`/trips/${tripId}/places/new`)} />
      </View>
      {tags.length > 0 && <ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <Pill label="전체" selected={effectiveTag === "all"} onPress={() => changeTag("all")} />
        {tags.map((tag) => <Pill key={tag} label={tagLabel(tag)} selected={effectiveTag === tag} onPress={() => changeTag(tag)} />)}
      </ScrollView>}
      {!loading && places.length > 0 && <Card>
        <View style={styles.selectionSummary}>
          <AppText variant="label">{selectedCount}개 선택됨</AppText>
          <Pressable accessibilityRole="button" onPress={allFilteredSelected ? clearSelection : () => selectPlaces(filteredPlaces.map((place) => place.id))}>
            <AppText variant="label" color={colors.primary}>{allFilteredSelected ? "전체 선택 해제" : "현재 목록 전체 선택"}</AppText>
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
      {filteredPlaces.map((place) => <Card key={place.id}>
        <View style={styles.placeCard}>
          <PlaceCardVisual placeId={place.id} tag={place.tag} tripId={tripId} />
          <View style={styles.placeBody}>
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
              <Pill label={tagLabel(place.tag)} />
            </View>
            <AppText color={colors.muted}>{placeDescription(place.note, place.address)}</AppText>
          </View>
        </View>
      </Card>)}
      {message && <Button label="다시 불러오기" variant="ghost" onPress={() => void reload()} />}
    </Screen>
  );
}

const tagLabels: Record<string, string> = {
  activity: "체험", attraction: "명소", cafe: "카페", food: "식사",
  lodging: "숙소", other: "기타", shopping: "쇼핑", transport: "이동",
};

function tagLabel(tag: string) { return tagLabels[tag] ?? tag; }

function tagIcon(tag: string) {
  return ({ activity: "🎟", attraction: "📍", cafe: "☕", food: "🍽", lodging: "🛏", shopping: "🛍", transport: "🚉" } as Record<string, string>)[tag] ?? "✦";
}

function tagVisualStyle(tag: string) {
  if (tag === "food") return styles.foodVisual;
  if (tag === "cafe") return styles.cafeVisual;
  if (tag === "attraction" || tag === "activity") return styles.attractionVisual;
  return styles.defaultVisual;
}

function PlaceCardVisual({ placeId, tag, tripId }: { placeId: string; tag: string; tripId: string }) {
  const [photo, setPhoto] = useState<PlacePhoto | null>();
  useEffect(() => {
    let active = true;
    void getPlacePhoto(tripId, placeId)
      .then((nextPhoto) => { if (active) setPhoto(nextPhoto.imageUrl && nextPhoto.googleMapsUri ? nextPhoto : null); })
      .catch(() => { if (active) setPhoto(null); });
    return () => { active = false; };
  }, [placeId, tripId]);

  if (!photo?.imageUrl || !photo.googleMapsUri) {
    return <View style={[styles.placeVisual, tagVisualStyle(tag)]}>
      <AppText style={styles.placeVisualText}>{tagIcon(tag)}</AppText>
    </View>;
  }
  const attribution = photo.authorNames.length > 0
    ? `Google Maps · ${photo.authorNames.join(", ")}`
    : "Google Maps에서 사진 보기";
  const sourceUri = photo.googleMapsUri;
  return <View style={styles.photoColumn}>
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(sourceUri)}>
      <Image
        accessibilityLabel="장소 대표 사진"
        cachePolicy="none"
        contentFit="cover"
        onError={() => setPhoto(null)}
        source={{ uri: photo.imageUrl }}
        style={styles.placePhoto}
        transition={150}
      />
    </Pressable>
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(sourceUri)}>
      <AppText variant="caption" color={colors.muted} numberOfLines={2} style={styles.photoAttribution}>{attribution}</AppText>
    </Pressable>
  </View>;
}

export function placeDescription(note: string | null | undefined, address: string | null | undefined) {
  const cleaned = note?.replace(/^AI 추천\s*·\s*(?:보관함\s*·\s*)?/u, "").trim();
  return cleaned || address || "추가 설명이 없어요";
}

const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  attractionVisual: { backgroundColor: colors.primarySoft },
  cafeVisual: { backgroundColor: "#F6E8D5" },
  checkbox: { width: 28, height: 28, borderWidth: 2, borderColor: colors.line, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  defaultVisual: { backgroundColor: colors.secondarySoft },
  filters: { gap: spacing.xs, paddingRight: spacing.lg },
  filterScroll: { flexGrow: 0, marginHorizontal: -spacing.lg, paddingLeft: spacing.lg },
  foodVisual: { backgroundColor: "#FCE3DC" },
  header: { gap: spacing.xs },
  managementActions: { flexDirection: "row", gap: spacing.sm },
  placeBody: { flex: 1, gap: spacing.xs },
  placeCard: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  placeName: { flexShrink: 1 },
  placePhoto: { width: 84, height: 76, borderRadius: 16, backgroundColor: colors.line },
  placeVisual: { width: 76, height: 76, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  placeVisualText: { fontSize: 30 },
  photoAttribution: { fontSize: 12, lineHeight: 16, textAlign: "center" },
  photoColumn: { width: 84, gap: spacing.xs },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  selectionSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stickyAction: { backgroundColor: colors.canvas, paddingVertical: spacing.xs },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
