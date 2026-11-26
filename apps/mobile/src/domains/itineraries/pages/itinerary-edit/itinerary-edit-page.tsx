import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { RouteConnector } from "./route-connector";
import { DayActivityTimeline, timelineMapItems } from "./day-activity-timeline";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import { Sortable, SortableItem, type SortableRenderItemProps } from "react-native-reanimated-dnd";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { TripNavigation } from "@/shared/ui/trip-navigation";
import { Screen } from "@/shared/ui/screen";
import type { SavedPlace } from "@/domains/places/api/places.api";
import type { ItineraryItem } from "../../api/itineraries.api";
import { DayPlacePicker } from "./day-place-picker";
import { DayRouteMap } from "./day-route-map";
import { DraggableItineraryItem } from "./draggable-itinerary-item";
import { isLodgingPlace, type LodgingEdge } from "./itinerary-lodging-endpoints";
import { LodgingEndpointPicker } from "./lodging-endpoint-picker";
import { useItineraryEdit } from "./use-itinerary-edit";
import { useAppDialog } from "@/shared/ui/app-dialog";
import { AiPlanLoadingScreen } from "../ai-plan/ai-plan-loading-screen";

function dayLabel(date: string, index: number) {
  const parsed = new Date(`${date}T12:00:00`);
  const shortDate = parsed.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
  return { day: `Day ${index + 1}`, date: shortDate };
}

const ITINERARY_CARD_HEIGHT = 80;
const TRAVEL_CONNECTOR_HEIGHT = 44;
const ITINERARY_ITEM_HEIGHT = ITINERARY_CARD_HEIGHT + TRAVEL_CONNECTOR_HEIGHT;

export default function ItineraryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const {
    dates, error, hasChanges, itinerary, places, reload,
    removeFromItinerary, reorderWithinDay, replaceDayLodging, save, saving, setPlacesForDate,
    updateDayWithAi, updatingDate,
  } = useItineraryEdit(tripId);
  const allowNavigation = useUnsavedChanges(hasChanges, saving || Boolean(updatingDate));
  const { showDialog } = useAppDialog();
  const screenRef = useRef<ScrollViewInstance>(null);
  const reorderCommitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [activeDate, setActiveDate] = useState<string>();
  const [mapAnimationPaused, setMapAnimationPaused] = useState(false);
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
  const [showPlaceEditor, setShowPlaceEditor] = useState(false);
  const dayActivities = (itinerary?.activities ?? []).filter((activity) => activity.date === selectedDate);
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
  const sortableHeight = movableItems.length * ITINERARY_ITEM_HEIGHT
    - (hasFixedEnd ? 0 : TRAVEL_CONNECTOR_HEIGHT);
  const updatingDayIndex = updatingDate ? dates.indexOf(updatingDate) : -1;

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

  const confirmDayUpdate = () => showDialog({
    title: `Day ${dayIndex + 1} 일정을 업데이트할까요?`,
    message: "사용자가 추가한 장소를 포함해 이 날짜만 다시 구성하고, 다른 날짜 일정은 변경하지 않아요.",
    actions: [
      { label: "취소", variant: "ghost" },
      { label: "업데이트", onPress: () => void updateDayWithAi(selectedDate) },
    ],
  });

  return <>
  <Screen
    bottomSlot={<TripNavigation tripId={tripId} active="itinerary" onNavigate={(navigate) => {
      if (!hasChanges) { navigate(); return; }
      showDialog({ title: "저장하지 않은 일정이 있어요", message: "변경한 일정을 저장한 뒤 이동할 수 있어요.", actions: [
        { label: "계속 편집", variant: "ghost" },
        { label: "저장하지 않고 이동", variant: "ghost", onPress: () => { allowNavigation(); navigate(); } },
        { label: "저장하고 이동", onPress: () => void save().then((saved) => { if (saved) navigate(); }) },
      ] });
    }} />}
    ref={screenRef}
    testID="itinerary-screen"
    onScrollBeginDrag={() => setMapAnimationPaused(true)}
    onScrollEndDrag={finishScreenScroll}
    onMomentumScrollEnd={finishScreenScroll}
    scrollEventThrottle={32}
  >
    <AppText variant="display">하루를, 천천히.</AppText>
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

    {selectedDate && <View style={styles.day}>
      <DayRouteMap animationPaused={mapAnimationPaused} focusTarget={mapFocusTarget} items={dayActivities.length > 0 ? timelineMapItems(items, dayActivities, places, hasFixedStart ? firstItem?.id : undefined, hasFixedEnd ? lastItem?.id : undefined) : items} />

      <View style={styles.scheduleHeader}>
        <AppText variant="label">DAY {String(dayIndex + 1).padStart(2, "0")} · {items.length}곳</AppText>
        <Button
          disabled={Boolean(updatingDate)}
          label={updatingDate === selectedDate ? "업데이트 중…" : "일정 업데이트"}
          variant="secondary"
          style={styles.updateButton}
          testID={`itinerary-ai-update-${selectedDate}`}
          onPress={confirmDayUpdate}
        />
      </View>
      {items.length === 0 && <AppText color={colors.muted}>아직 배치된 장소가 없어요.</AppText>}
      {dayActivities.length > 0 && <>
        <DayActivityTimeline items={items} activities={dayActivities}
          startId={hasFixedStart ? firstItem?.id : undefined} endId={hasFixedEnd ? lastItem?.id : undefined}
          onPlacePress={focusPlaceOnMap} />
        <Button label={showPlaceEditor ? "장소 순서 편집 닫기" : "장소 순서 편집"} variant="ghost" onPress={() => setShowPlaceEditor(!showPlaceEditor)} />
        {showPlaceEditor && <AppText variant="caption" color={colors.muted}>방문 시각까지 다시 구성하려면 일정 업데이트를 사용하세요.</AppText>}
      </>}
      {(dayActivities.length === 0 || showPlaceEditor) && <View style={styles.placeList}>
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
          timePrefix="출발"
        />}
        {hasFixedStart && items.length > 1 && <RouteConnector />}
        {movableItems.length > 0 && <View
          style={[styles.sortableViewport, { height: sortableHeight }]}
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
                itemHeight={ITINERARY_ITEM_HEIGHT}
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
                  description={item.activitySummary}
                  placeName={item.placeName}
                  scheduledTime={item.scheduledTime}
                />
                {placeIndex < items.length - 1 && <RouteConnector />}
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
        />}
      </View>}
      <View style={styles.addPlaceAction}>
        <Button label="＋" accessibilityLabel={`Day ${dayIndex + 1} 장소 추가`} variant="ghost" testID={`itinerary-add-places-${selectedDate}`} onPress={() => setPlacePickerDay({ date: selectedDate, index: dayIndex })} />
      </View>
    </View>}

    <Button label={saving ? "저장 중…" : "변경한 일정 저장"} disabled={!itinerary || saving} testID="itinerary-save" onPress={() => void save().then((saved) => { if (saved) { allowNavigation(); router.back(); } })} />
  </Screen>
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
  {updatingDate && <Modal
    animationType="fade"
    onRequestClose={() => undefined}
    presentationStyle="fullScreen"
    statusBarTranslucent
    visible
  >
    <AiPlanLoadingScreen dayLabel={updatingDayIndex >= 0 ? `Day ${updatingDayIndex + 1}` : "선택한 날짜"} />
  </Modal>}
  </>;
}

const styles = StyleSheet.create({
  day: { gap: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tabs: { gap: spacing.sm, paddingRight: spacing.lg },
  tabScroll: { flexGrow: 0, marginHorizontal: -spacing.lg, paddingLeft: spacing.lg },
  tab: { minWidth: 88, gap: 2, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedTab: { borderColor: colors.primary, backgroundColor: colors.primary },
  scheduleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm },
  updateButton: { minHeight: 44, paddingHorizontal: spacing.md },
  addPlaceAction: { position: "relative", zIndex: 10, elevation: 10 },
  placeList: { overflow: "visible" },
  sortableViewport: { zIndex: 2, elevation: 2, overflow: "visible" },
  sortableList: { flex: 1, overflow: "visible", backgroundColor: "transparent" },
  sortableContent: { overflow: "visible" },
  sortableItem: { height: ITINERARY_ITEM_HEIGHT, overflow: "visible" },
});
