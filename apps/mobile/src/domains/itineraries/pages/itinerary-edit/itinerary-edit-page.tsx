import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
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
import { useItineraryEdit } from "./use-itinerary-edit";

function dayLabel(date: string, index: number) {
  const parsed = new Date(`${date}T12:00:00`);
  const shortDate = parsed.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  return { day: `Day ${index + 1}`, date: shortDate };
}

// A two-line description produces the tallest supported card. Starting from
// that upper bound prevents items from overlapping before native measurement
// reports their exact content height.
const ESTIMATED_ITINERARY_ITEM_HEIGHT = 180;

export default function ItineraryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const {
    dates, error, itinerary, places, reload,
    removeFromItinerary, reorderWithinDay, replaceDayLodging, save, saving, setPlacesForDate,
    undoAiChange, undoing, undoMessage,
  } = useItineraryEdit(tripId);
  const screenRef = useRef<ScrollViewInstance>(null);
  const reorderCommitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [activeDate, setActiveDate] = useState<string>();
  const [mapAnimationPaused, setMapAnimationPaused] = useState(false);
  const [measuredSortable, setMeasuredSortable] = useState({ signature: "", height: 0 });
  const [mapFocusTarget, setMapFocusTarget] = useState<{ itemId: string; request: number }>();
  const [placePickerDay, setPlacePickerDay] = useState<{ date: string; index: number }>();
  const [lodgingPicker, setLodgingPicker] = useState<{ current: SavedPlace; date: string; dayIndex: number; edge: LodgingEdge }>();
  const selectedDate = activeDate && dates.includes(activeDate) ? activeDate : dates[0];
  const dayIndex = Math.max(0, dates.indexOf(selectedDate));
  const grouped = useMemo(() => (itinerary?.items ?? []).reduce<Record<string, ItineraryItem[]>>((groups, item) => {
    const date = item.date ?? "미배치";
    (groups[date] ??= []).push(item);
    return groups;
  }, {}), [itinerary?.items]);
  const items = useMemo(() => [...(grouped[selectedDate] ?? [])].sort((left, right) => (left.position ?? 0) - (right.position ?? 0)), [grouped, selectedDate]);
  const placesById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const firstItem = items[0];
  const lastItem = items.at(-1);
  const startLodging = firstItem?.savedPlaceId ? placesById.get(firstItem.savedPlaceId) : undefined;
  const lastSavedPlaceId = items.at(-1)?.savedPlaceId;
  const endLodging = lastSavedPlaceId ? placesById.get(lastSavedPlaceId) : undefined;
  const hasStartBoundary = firstItem?.boundaryType === "start_point";
  const hasEndBoundary = lastItem?.boundaryType === "end_point";
  const hasFixedStart = hasStartBoundary || (dayIndex > 0 && isLodgingPlace(startLodging));
  const hasFixedEnd = hasEndBoundary || (dayIndex < dates.length - 1 && isLodgingPlace(endLodging));
  const movableStartIndex = hasFixedStart ? 1 : 0;
  const movableEndIndex = hasFixedEnd ? items.length - 1 : items.length;
  const movableItems = items.slice(movableStartIndex, movableEndIndex);
  const movableSignature = movableItems.map(({ id }) => id).join("|");
  const sortableHeight = measuredSortable.signature === movableSignature
    ? measuredSortable.height
    : movableItems.length * ESTIMATED_ITINERARY_ITEM_HEIGHT;
  const handleHeightsMeasured = useCallback((heights: Record<string, number>) => {
    const height = Object.values(heights).reduce((total, itemHeight) => total + itemHeight, 0);
    setMeasuredSortable({ signature: movableSignature, height });
  }, [movableSignature]);

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

  const finishScreenScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // The map is above the schedule. Keep its decorative route animation stopped
    // when it is off screen so it cannot compete with list scrolling.
    setMapAnimationPaused(event.nativeEvent.contentOffset.y > 360);
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

  return <Screen
    ref={screenRef}
    testID="itinerary-screen"
    onScrollBeginDrag={() => setMapAnimationPaused(true)}
    onScrollEndDrag={finishScreenScroll}
    onMomentumScrollEnd={finishScreenScroll}
    scrollEventThrottle={32}
  >
    <AppText variant="title">일정을 다듬어 보세요</AppText>
    <AppText color={colors.muted}>날짜를 고르고 지도 동선과 장소 순서를 편집하세요.</AppText>
    {error && <Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card>}
    {!itinerary && !error && <Card><AppText color={colors.muted}>일정을 불러오는 중이에요…</AppText></Card>}

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
      <DayRouteMap animationPaused={mapAnimationPaused} focusTarget={mapFocusTarget} items={items} />

      <View style={styles.scheduleHeader}>
        <AppText variant="heading">방문 일정</AppText>
        {items.length > 0 && <AppText variant="caption" color={colors.muted}>카드를 끌어 이동</AppText>}
      </View>
      {items.length === 0 && <AppText color={colors.muted}>아직 배치된 장소가 없어요.</AppText>}
      <View style={styles.placeList}>
        {hasFixedStart && <DraggableItineraryItem
          fixed
          fixedLabel={hasStartBoundary ? "시작 지점" : "시작 숙소"}
          index={0}
          itemCount={items.length}
          key={items[0].id}
          onPress={() => focusPlaceOnMap(items[0].id)}
          onEdit={hasStartBoundary ? undefined : () => setLodgingPicker({ current: startLodging!, date: selectedDate, dayIndex, edge: "start" })}
          onRemove={() => undefined}
          onReorder={() => undefined}
          placeName={items[0].placeName}
          scheduledTime={items[0].scheduledTime}
          activitySummary={items[0].activitySummary}
        />}
        {movableItems.length > 0 && <View
          style={[styles.sortableViewport, { height: sortableHeight }]}
          testID="itinerary-sortable-list"
        >
          <Sortable
            contentContainerStyle={styles.sortableContent}
            data={movableItems}
            enableDynamicHeights
            estimatedItemHeight={ESTIMATED_ITINERARY_ITEM_HEIGHT}
            onHeightsMeasured={handleHeightsMeasured}
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
          fixedLabel={hasEndBoundary ? "종료 지점" : "마지막 숙소"}
          index={items.length - 1}
          itemCount={items.length}
          key={items.at(-1)!.id}
          onPress={() => focusPlaceOnMap(items.at(-1)!.id)}
          onEdit={hasEndBoundary ? undefined : () => setLodgingPicker({ current: endLodging!, date: selectedDate, dayIndex, edge: "end" })}
          onRemove={() => undefined}
          onReorder={() => undefined}
          placeName={items.at(-1)!.placeName}
          scheduledTime={items.at(-1)!.scheduledTime}
          activitySummary={items.at(-1)!.activitySummary}
        />}
      </View>
      <AppText variant="caption" color={colors.muted}>왼쪽 핸들을 누른 채 위·아래로 끌어 순서를 바꿔요. 숙소와 시작·종료 지점은 고정돼요.</AppText>
      <Button label="＋ 여행 장소 추가" variant="ghost" testID={`itinerary-add-places-${selectedDate}`} onPress={() => setPlacePickerDay({ date: selectedDate, index: dayIndex })} />
    </Card>}

    <Button label={saving ? "저장 중…" : "일정 저장"} disabled={!itinerary || saving} testID="itinerary-save" onPress={() => void save().then((saved) => { if (saved) router.back(); })} />
    <Button label={undoing ? "되돌리는 중…" : "최근 AI 변경 한 번 되돌리기"} disabled={undoing} variant="ghost" onPress={() => void undoAiChange()} />
    {undoMessage && <AppText variant="caption" color={colors.muted} style={styles.undoMessage}>{undoMessage}</AppText>}
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
  scheduleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  placeList: { gap: spacing.sm, overflow: "visible" },
  sortableViewport: { zIndex: 2, elevation: 2, overflow: "visible" },
  sortableList: { flex: 1, overflow: "visible", backgroundColor: "transparent" },
  sortableContent: { overflow: "visible" },
  sortableItem: { paddingBottom: spacing.sm, overflow: "visible" },
  undoMessage: { marginTop: -spacing.sm, textAlign: "center" },
});
