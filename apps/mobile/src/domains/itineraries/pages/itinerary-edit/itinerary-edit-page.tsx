import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from "react-native";
import { Sortable, SortableItem, type SortableRenderItemProps } from "react-native-reanimated-dnd";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pill } from "@/shared/ui/pill";
import { Screen } from "@/shared/ui/screen";
import type { SavedPlace } from "@/domains/places/api/places.api";
import type { ItineraryItem } from "../../api/itineraries.api";
import { DayPlacePicker } from "./day-place-picker";
import { DayRouteMap } from "./day-route-map";
import { DraggableItineraryItem } from "./draggable-itinerary-item";
import { isLodgingPlace, type LodgingEdge } from "./itinerary-lodging-endpoints";
import { LodgingEndpointPicker } from "./lodging-endpoint-picker";
import { useItineraryDaySettings } from "./use-itinerary-day-settings";
import { useItineraryEdit } from "./use-itinerary-edit";

function dayLabel(date: string, index: number) {
  const parsed = new Date(`${date}T12:00:00`);
  const shortDate = parsed.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  return { day: `Day ${index + 1}`, date: shortDate };
}

const ITINERARY_ITEM_HEIGHT = 184;

export default function ItineraryScreen() {
  const { aiGenerated, tripId } = useLocalSearchParams<{ aiGenerated?: string; tripId: string }>();
  const {
    dates, error, itinerary, places, reload,
    removeFromItinerary, reorderWithinDay, replaceDayLodging, save, saving, setPlacesForDate,
    undoAiChange, undoing,
  } = useItineraryEdit(tripId);
  const daySettings = useItineraryDaySettings(tripId);
  const screenRef = useRef<ScrollViewInstance>(null);
  const reorderCommitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [activeDate, setActiveDate] = useState<string>();
  const [mapFocusTarget, setMapFocusTarget] = useState<{ itemId: string; request: number }>();
  const [placePickerDay, setPlacePickerDay] = useState<{ date: string; index: number }>();
  const [lodgingPicker, setLodgingPicker] = useState<{ current: SavedPlace; date: string; dayIndex: number; edge: LodgingEdge }>();
  const selectedDate = activeDate && dates.includes(activeDate) ? activeDate : dates[0];
  const dayIndex = Math.max(0, dates.indexOf(selectedDate));
  const grouped = (itinerary?.items ?? []).reduce<Record<string, ItineraryItem[]>>((groups, item) => {
    const date = item.date ?? "미배치";
    (groups[date] ??= []).push(item);
    return groups;
  }, {});
  const items = [...(grouped[selectedDate] ?? [])].sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const setting = daySettings.settings.find((candidate) => candidate.date === selectedDate);
  const placesById = new Map(places.map((place) => [place.id, place]));
  const startLodging = items[0]?.savedPlaceId ? placesById.get(items[0].savedPlaceId) : undefined;
  const lastSavedPlaceId = items.at(-1)?.savedPlaceId;
  const endLodging = lastSavedPlaceId ? placesById.get(lastSavedPlaceId) : undefined;
  const hasFixedStart = isLodgingPlace(startLodging);
  const hasFixedEnd = items.length > 1 && isLodgingPlace(endLodging);
  const movableStartIndex = hasFixedStart ? 1 : 0;
  const movableEndIndex = hasFixedEnd ? items.length - 1 : items.length;
  const movableItems = items.slice(movableStartIndex, movableEndIndex);

  const focusPlaceOnMap = (itemId: string) => {
    setMapFocusTarget((current) => ({ itemId, request: (current?.request ?? 0) + 1 }));
    screenRef.current?.scrollTo({ y: 0, animated: true });
  };

  const startItemDrag = () => {
    screenRef.current?.setNativeProps({ scrollEnabled: false });
  };

  const endItemDrag = () => {
    screenRef.current?.setNativeProps({ scrollEnabled: true });
  };

  useEffect(() => () => {
    if (reorderCommitTimer.current) clearTimeout(reorderCommitTimer.current);
  }, []);

  const commitDroppedOrder = (itemId: string, targetIndex: number) => {
    if (reorderCommitTimer.current) clearTimeout(reorderCommitTimer.current);
    // The sortable list owns the animation state. Commit after its 300 ms settle
    // so changing the external data cannot remount a card during the drop frame.
    reorderCommitTimer.current = setTimeout(() => {
      reorderWithinDay(itemId, targetIndex);
      reorderCommitTimer.current = undefined;
    }, 310);
  };

  return <Screen ref={screenRef} testID="itinerary-screen">
    <AppText variant="title">일정을 다듬어 보세요</AppText>
    <AppText color={colors.muted}>날짜를 고르고 지도 동선과 장소 순서를 편집하세요.</AppText>
    {aiGenerated === "1" && <Card>
      <AppText variant="heading" color={colors.primary}>AI 일정이 생성됐어요</AppText>
      <AppText color={colors.muted}>배치되지 않은 장소가 있다면 아래에서 확인하고 원하는 날짜에 직접 추가할 수 있어요.</AppText>
    </Card>}
    {error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
    {!itinerary && !error && <Card><AppText color={colors.muted}>일정을 불러오는 중이에요…</AppText></Card>}

    {(itinerary?.unplaced.length ?? 0) > 0 && <Card>
      <AppText variant="heading">배치되지 않은 장소</AppText>
      <AppText color={colors.muted}>AI가 동선에 넣지 못한 장소예요. 날짜별 ‘여행 장소 추가’에서 직접 배치할 수 있어요.</AppText>
      {itinerary!.unplaced.map((place) => <AppText key={place.savedPlaceId}>• {place.placeName}</AppText>)}
    </Card>}

    {dates.length > 0 && <ScrollView horizontal contentContainerStyle={styles.tabs} showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
      {dates.map((date, index) => {
        const label = dayLabel(date, index);
        const selected = date === selectedDate;
        return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={date} onPress={() => setActiveDate(date)} style={[styles.tab, selected && styles.selectedTab]} testID={`itinerary-date-tab-${date}`}>
          <AppText variant="label" color={selected ? colors.white : colors.ink}>{label.day}</AppText>
          <AppText variant="caption" color={selected ? colors.white : colors.muted}>{label.date}</AppText>
        </Pressable>;
      })}
    </ScrollView>}

    {selectedDate && <Card>
      <View style={styles.row}><AppText variant="heading">Day {dayIndex + 1}</AppText><Pill label={selectedDate} /></View>
      <DayRouteMap focusTarget={mapFocusTarget} items={items} />

      {setting && <View style={styles.daySettings}>
        <AppText variant="label">활동 시간</AppText>
        <View style={styles.timeRow}>
          <TextInput accessibilityLabel={`${selectedDate} 시작 시간`} value={setting.startTime} onChangeText={(startTime) => daySettings.update(selectedDate, { startTime })} placeholder="09:00" style={styles.timeInput} />
          <AppText color={colors.muted}>–</AppText>
          <TextInput accessibilityLabel={`${selectedDate} 종료 시간`} value={setting.endTime} onChangeText={(endTime) => daySettings.update(selectedDate, { endTime })} placeholder="21:00" style={styles.timeInput} />
        </View>
        {setting.planBPlaceName && <View style={styles.planB}>
          <AppText variant="label" color={colors.secondary}>비 오는 날 Plan B</AppText>
          <AppText>{setting.planBPlaceName}</AppText>
          {setting.planBAddress && <AppText variant="caption" color={colors.muted}>{setting.planBAddress}</AppText>}
          {setting.planBReason && <AppText variant="caption" color={colors.muted}>{setting.planBReason}</AppText>}
          <AppText variant="caption" color={colors.warning}>방문 전 공식 채널에서 운영 시간과 휴무일을 확인해 주세요.</AppText>
        </View>}
      </View>}

      <View style={styles.scheduleHeader}>
        <AppText variant="heading">방문 일정</AppText>
        {items.length > 0 && <AppText variant="caption" color={colors.muted}>카드를 끌어 이동</AppText>}
      </View>
      {items.length === 0 && <AppText color={colors.muted}>아직 배치된 장소가 없어요.</AppText>}
      <View style={styles.placeList}>
        {hasFixedStart && <DraggableItineraryItem
          fixed
          fixedLabel="시작 숙소"
          index={0}
          itemCount={items.length}
          key={items[0].id}
          onPress={() => focusPlaceOnMap(items[0].id)}
          onEdit={() => setLodgingPicker({ current: startLodging!, date: selectedDate, dayIndex, edge: "start" })}
          onRemove={() => undefined}
          onReorder={() => undefined}
          placeName={items[0].placeName}
        />}
        {movableItems.length > 0 && <View
          style={[styles.sortableViewport, { height: movableItems.length * ITINERARY_ITEM_HEIGHT }]}
          testID="itinerary-sortable-list"
        >
          <Sortable
            contentContainerStyle={styles.sortableContent}
            data={movableItems}
            itemHeight={ITINERARY_ITEM_HEIGHT}
            style={styles.sortableList}
            useFlatList={false}
            renderItem={(props: SortableRenderItemProps<ItineraryItem>) => {
              const { id, index, item, ...sortableProps } = props;
              const placeIndex = index + movableStartIndex;
              return <SortableItem
                {...sortableProps}
                data={item}
                id={id}
                key={id}
                itemHeight={ITINERARY_ITEM_HEIGHT}
                onDragStart={startItemDrag}
                onDrop={(_, targetIndex) => {
                  endItemDrag();
                  if (index !== targetIndex) commitDroppedOrder(item.id, targetIndex + movableStartIndex);
                }}
                style={styles.sortableItem}
              >
                <DraggableItineraryItem
                  index={placeIndex}
                  itemCount={items.length}
                  minIndex={movableStartIndex}
                  maxIndex={movableEndIndex - 1}
                  onPress={() => focusPlaceOnMap(item.id)}
                  onRemove={() => removeFromItinerary(item.id)}
                  onReorder={(targetIndex) => reorderWithinDay(item.id, targetIndex)}
                  placeName={item.placeName}
                  scheduledTime={item.scheduledTime}
                  durationMinutes={item.durationMinutes}
                  activitySummary={item.activitySummary}
                  travelMethod={item.travelMethod}
                  travelDurationMinutes={item.travelDurationMinutes}
                />
              </SortableItem>;
            }}
          />
        </View>}
        {hasFixedEnd && <DraggableItineraryItem
          fixed
          fixedLabel="마지막 숙소"
          index={items.length - 1}
          itemCount={items.length}
          key={items.at(-1)!.id}
          onPress={() => focusPlaceOnMap(items.at(-1)!.id)}
          onEdit={() => setLodgingPicker({ current: endLodging!, date: selectedDate, dayIndex, edge: "end" })}
          onRemove={() => undefined}
          onReorder={() => undefined}
          placeName={items.at(-1)!.placeName}
        />}
      </View>
      <AppText variant="caption" color={colors.muted}>왼쪽 핸들을 누른 채 위·아래로 끌어 순서를 바꿔요. 숙소는 고정돼요.</AppText>
      <Button label="＋ 여행 장소 추가" variant="ghost" testID={`itinerary-add-places-${selectedDate}`} onPress={() => setPlacePickerDay({ date: selectedDate, index: dayIndex })} />
    </Card>}

    {daySettings.message && <AppText color={colors.secondary}>{daySettings.message}</AppText>}
    <Button label={daySettings.saving ? "시간 저장 중…" : "날짜별 활동 시간 저장"} disabled={daySettings.loading || daySettings.saving || daySettings.settings.length === 0} variant="secondary" testID="itinerary-day-settings-save" onPress={() => void daySettings.save()} />
    <Button label={saving ? "저장 중…" : "일정 저장"} disabled={!itinerary || saving} testID="itinerary-save" onPress={() => void save().then((saved) => { if (saved) router.back(); })} />
    <Button label={undoing ? "되돌리는 중…" : "최근 AI 변경 한 번 되돌리기"} disabled={undoing} variant="ghost" onPress={() => void undoAiChange()} />
    {placePickerDay && <DayPlacePicker tripId={tripId} date={placePickerDay.date} dayIndex={placePickerDay.index} items={itinerary?.items ?? []} places={places} onApply={setPlacesForDate} onClose={() => setPlacePickerDay(undefined)} />}
    {lodgingPicker && <LodgingEndpointPicker
      current={lodgingPicker.current}
      date={lodgingPicker.date}
      dayIndex={lodgingPicker.dayIndex}
      edge={lodgingPicker.edge}
      places={places}
      tripId={tripId}
      onApply={(place, availablePlaces) => replaceDayLodging(lodgingPicker.date, lodgingPicker.edge, place, availablePlaces)}
      onClose={() => setLodgingPicker(undefined)}
    />}
  </Screen>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tabs: { gap: spacing.sm, paddingRight: spacing.lg },
  tabScroll: { flexGrow: 0, marginHorizontal: -spacing.lg, paddingLeft: spacing.lg },
  tab: { minWidth: 88, gap: 2, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedTab: { borderColor: colors.primary, backgroundColor: colors.primary },
  daySettings: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  planB: { gap: spacing.xs, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.secondarySoft },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: spacing.md, color: colors.ink },
  scheduleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  placeList: { gap: spacing.sm, overflow: "visible" },
  sortableViewport: { zIndex: 2, elevation: 2, overflow: "visible" },
  sortableList: { flex: 1, overflow: "visible", backgroundColor: "transparent" },
  sortableContent: { overflow: "visible" },
  sortableItem: { height: ITINERARY_ITEM_HEIGHT, paddingBottom: spacing.sm, overflow: "visible" },
});
