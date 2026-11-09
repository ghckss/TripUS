import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { SavedPlace } from "@/domains/places/api/places.api";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import type { ItineraryItem } from "../../api/itineraries.api";

type DayPlacePickerProps = {
  date: string;
  dayIndex: number;
  items: ItineraryItem[];
  places: SavedPlace[];
  onApply: (date: string, selectedPlaceIds: string[]) => void;
  onClose: () => void;
};

export function DayPlacePicker({ date, dayIndex, items, places, onApply, onClose }: DayPlacePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter((item) => item.date === date).map((item) => item.savedPlaceId)));
  const [tab, setTab] = useState<"unplaced" | "all">("unplaced");

  const placedIds = new Set(items.map((item) => item.savedPlaceId));
  const unplacedPlaces = places.filter((place) => !placedIds.has(place.id));
  const displayedPlaces = tab === "unplaced" ? unplacedPlaces : places;
  const toggle = (placeId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
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
          <AppText variant="label" color={tab === "all" ? colors.primary : colors.muted}>전체 장소 · {places.length}</AppText>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {displayedPlaces.length === 0 && <View style={styles.empty}>
          <AppText variant="heading">{places.length === 0 ? "저장한 여행 장소가 없어요" : "미배치 장소가 없어요"}</AppText>
          <AppText color={colors.muted}>{places.length === 0 ? "먼저 장소 보관함에서 여행 장소를 추가해 주세요." : "전체 장소 탭에서 이미 배치한 장소를 다시 추가할 수 있어요."}</AppText>
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
        <Button label={`${selected.size}곳 선택 적용`} testID="itinerary-place-picker-apply" onPress={() => { onApply(date, [...selected]); onClose(); }} />
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  empty: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, gap: spacing.sm },
  place: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  placeSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  checkbox: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  placeText: { flex: 1, gap: spacing.xs },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
});
