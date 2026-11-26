import { useApiQuery } from "@/shared/query/use-resource";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { getPlacePhoto } from "@/domains/places/api/places.api";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import { EditorialHeading, FieldIcon, FieldIllustration } from "@/shared/ui/field-notes";
import { TripNavigation } from "@/shared/ui/trip-navigation";
import { colors, fonts, spacing } from "@/shared/design/tokens";
import { placeDescription } from "./place-description";
import { type PlaceTag, usePlaceLibrary } from "./use-place-library";
import { useAppDialog } from "@/shared/ui/app-dialog";

export default function PlacesScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const {
    clearSelection, places, loading, saving, message, reload,
    removePlaces, selectPlaces, selectedIds, toggleSelection, updatePlacesTag,
  } = usePlaceLibrary(tripId);
  const { showDialog } = useAppDialog();
  const [query, setQuery] = useState("");
  const [managing, setManaging] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const selectedCount = selectedIds.size;
  const [activeTag, setActiveTag] = useState<string>("all");
  const tags = useMemo(() => [...new Set(places.map((place) => place.tag))].sort(), [places]);
  const effectiveTag = activeTag === "all" || tags.some((tag) => tag === activeTag) ? activeTag : "all";
  const filteredPlaces = places.filter((place) => (effectiveTag === "all" || place.tag === effectiveTag) && `${place.name} ${placeDescription(place.note)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
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
    <Screen bottomSlot={<><View style={styles.bottomAction}>
      <Button label="＋" accessibilityLabel="장소 추가" testID="places-add" style={styles.addButton} variant="ghost" onPress={() => router.push(`/trips/${tripId}/places/new`)} />
      <Button label="모은 장소로 일정 만들기" style={styles.planButton} disabled={places.length === 0} onPress={() => router.push(`/trips/${tripId}/ai-plan`)} />
    </View><TripNavigation tripId={tripId} active="places" /></>}>
        <EditorialHeading eyebrow="PLACES TO KEEP" title="가보고 싶은 곳." description={`${places.length}곳을 모았어요. 일정은 그다음에.`} />
        <TextInput accessibilityLabel="저장한 장소 검색" placeholder="장소 이름이나 메모 검색" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={styles.search} />
        {tags.length > 0 && <ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Pill label={`전체 ${places.length}`} selected={effectiveTag === "all"} onPress={() => changeTag("all")} />
          {tags.map((tag) => <Pill key={tag} label={tagLabel(tag)} selected={effectiveTag === tag} onPress={() => changeTag(tag)} />)}
        </ScrollView>}
        {!loading && places.length > 0 && <Pressable accessibilityRole="button" accessibilityState={{ expanded: managing }} onPress={() => setManaging((value) => !value)} style={styles.manageToggle}><AppText variant="caption" color={colors.primary}>{managing ? "선택 관리 닫기" : "장소 선택·관리"}</AppText></Pressable>}
        {!loading && places.length > 0 && managing && <Card>
          <View style={styles.selectionSummary}>
            <AppText variant="label">{selectedCount}개 선택됨</AppText>
            <Pressable accessibilityRole="button" onPress={allFilteredSelected ? clearSelection : () => selectPlaces(filteredPlaces.map((place) => place.id))}>
              <AppText variant="label" color={colors.primary}>{allFilteredSelected ? "전체 선택 해제" : "현재 목록 전체 선택"}</AppText>
            </Pressable>
          </View>
          <View style={styles.managementActions}>
            <Button label="태그 변경" variant="secondary" disabled={saving || selectedCount === 0} style={styles.actionButton} onPress={() => setTagPickerOpen(true)} />
            <Button label={`선택 제거${selectedCount > 0 ? ` (${selectedCount})` : ""}`} variant="danger" disabled={saving || selectedCount === 0} style={styles.actionButton} onPress={confirmSelectedRemoval} />
          </View>
          <Button label="전체 제거" variant="ghost" disabled={saving} onPress={confirmAllRemoval} />
        </Card>}
        {message && <AppText color={colors.secondary}>{message}</AppText>}
        {loading && <Card><AppText color={colors.muted}>장소를 불러오는 중이에요…</AppText></Card>}
        {!loading && places.length === 0 && <Card><AppText variant="heading">아직 저장한 장소가 없어요</AppText><AppText color={colors.muted}>가고 싶은 장소를 먼저 저장해 보세요.</AppText></Card>}
        {filteredPlaces.map((place) => {
          const selected = selectedIds.has(place.id);
          const description = placeDescription(place.note);
          return <Pressable
            key={place.id}
            accessibilityLabel={`${place.name} ${selected ? "선택 해제" : "선택"}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => toggleSelection(place.id)}
            style={({ pressed }) => pressed && styles.placeCardPressed}
          >
            <Card style={[styles.placeCard, selected && styles.placeCardSelected]}>
              <View style={styles.placeMediaRow}>
                <PlaceCardVisual placeId={place.id} tag={place.tag} tripId={tripId} />
                <View style={styles.placeIdentity}>
                  <AppText numberOfLines={1} variant="heading" style={styles.placeName}>{place.name}</AppText>
                  {description && <AppText numberOfLines={3} color={colors.muted} style={styles.placeDescription}>{description}</AppText>}
                </View>
                <View style={styles.bookmark}><FieldIcon name="bookmark" color={selected ? colors.primary : colors.muted} /><AppText variant="micro" color={selected ? colors.primary : colors.muted}>{selected ? "선택됨" : "선택"}</AppText></View>
              </View>
            </Card>
          </Pressable>;
        })}
        {message && <Button label="다시 불러오기" variant="ghost" onPress={() => void reload()} />}
        {!loading && places.length > 0 && filteredPlaces.length === 0 && <AppText color={colors.muted}>검색 조건에 맞는 장소가 없어요.</AppText>}
        <AppText variant="micro" color={colors.muted}>장소를 선택해 관리하거나, 모아둔 곳으로 하루를 구성해 보세요.</AppText>
        <PlaceTagPicker
          visible={tagPickerOpen}
          saving={saving}
          selectedCount={selectedCount}
          onClose={() => setTagPickerOpen(false)}
          onSelect={(tag) => void updatePlacesTag([...selectedIds], tag).then((updated) => {
            if (!updated) return;
            setActiveTag("all");
            setTagPickerOpen(false);
          })}
        />
    </Screen>
  );
}

const tagLabels: Record<string, string> = {
  activity: "체험", attraction: "명소", cafe: "카페", food: "식사",
  lodging: "숙소", other: "기타", shopping: "쇼핑", transport: "이동",
};

function tagLabel(tag: string) { return tagLabels[tag] ?? tag; }

const editableTags = Object.keys(tagLabels) as PlaceTag[];

function PlaceTagPicker({ onClose, onSelect, saving, selectedCount, visible }: {
  onClose: () => void;
  onSelect: (tag: PlaceTag) => void;
  saving: boolean;
  selectedCount: number;
  visible: boolean;
}) {
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
    <View style={styles.tagModalBackdrop}>
      <View accessibilityViewIsModal style={styles.tagModalSheet}>
        <View style={styles.tagModalHeader}>
          <View style={styles.tagModalTitle}><AppText variant="heading">태그 변경</AppText><AppText color={colors.muted}>선택한 {selectedCount}개 장소에 적용해요.</AppText></View>
          <Pressable accessibilityLabel="태그 선택 닫기" accessibilityRole="button" hitSlop={8} onPress={onClose} style={styles.tagModalClose}><AppText variant="title">×</AppText></Pressable>
        </View>
        <View style={styles.tagOptions}>
          {editableTags.map((tag) => <Button key={tag} label={tagLabel(tag)} variant="ghost" disabled={saving} style={styles.tagOption} onPress={() => onSelect(tag)} />)}
        </View>
      </View>
    </View>
  </Modal>;
}

function PlaceCardVisual({ placeId, tag, tripId }: { placeId: string; tag: string; tripId: string }) {
  const { data: photo } = useApiQuery(`trips:${tripId}:photo:${placeId}`, getPlacePhoto, tripId, placeId);
  const [failedUrl, setFailedUrl] = useState<string>();
  if (!photo?.imageUrl || photo.imageUrl === failedUrl) {
    return <FieldIllustration kind={tag === "cafe" || tag === "food" ? "cafe" : tag === "attraction" ? "journey" : "park"} style={styles.placeVisual} />;
  }
  return <Image
    accessibilityLabel="장소 대표 사진"
    cachePolicy="memory"
    contentFit="cover"
    onError={() => setFailedUrl(photo.imageUrl ?? undefined)}
    source={{ uri: photo.imageUrl }}
    style={styles.placePhoto}
    transition={150}
  />;
}

const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  filters: { gap: spacing.xs, paddingRight: spacing.lg },
  filterScroll: { flexGrow: 0, marginHorizontal: -spacing.lg, paddingLeft: spacing.lg },
  managementActions: { flexDirection: "row", gap: spacing.sm },
  placeCard: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md, borderWidth: 0, borderBottomWidth: 1, borderRadius: 0, backgroundColor: colors.canvas },
  placeCardPressed: { opacity: 0.78 },
  placeCardSelected: { borderBottomColor: colors.primary, backgroundColor: colors.primarySoft },
  placeDescription: { flexShrink: 1 },
  placeMediaRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  placeIdentity: { flex: 1, minWidth: 0, gap: spacing.sm },
  placeName: { flexShrink: 1 },
  placePhoto: { width: 68, height: 77, borderRadius: 0, backgroundColor: colors.line },
  placeVisual: { width: 68, height: 77, borderRadius: 0, alignItems: "center", justifyContent: "center" },
  selectionSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bookmark: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  search: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.line, fontFamily: fonts.sans, fontSize: 14, color: colors.ink, paddingVertical: spacing.sm },
  manageToggle: { minHeight: 44, justifyContent: "center", alignItems: "flex-end" },
  addButton: { width: 50, paddingHorizontal: 0 },
  planButton: { flex: 1 },
  bottomAction: { flexDirection: "row", alignItems: "center", backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.line, padding: spacing.md, gap: spacing.sm },
  tagModalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 19, 18, 0.42)" },
  tagModalSheet: { gap: spacing.lg, borderTopLeftRadius: spacing.lg, borderTopRightRadius: spacing.lg, backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: spacing.xl },
  tagModalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  tagModalTitle: { flex: 1, gap: spacing.xs },
  tagModalClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tagOptions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tagOption: { minWidth: "30%", flexGrow: 1 },
});
