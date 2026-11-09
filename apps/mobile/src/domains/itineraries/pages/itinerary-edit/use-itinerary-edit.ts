import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getTrip } from "@/domains/trips";
import { listTravelPlaces, type SavedPlace } from "@/domains/places/api/places.api";
import { getItinerary, getTransitRoute, replaceItinerary, undoAiPlan, type Itinerary, type TransitRoute } from "../../api/itineraries.api";

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function normalizePositions(itinerary: Itinerary): Itinerary {
  const positions = new Map<string, number>();
  return {
    ...itinerary,
    items: [...itinerary.items]
      .sort((left, right) => `${left.date}:${left.position}`.localeCompare(`${right.date}:${right.position}`))
      .map((item) => {
        const date = item.date!;
        const position = positions.get(date) ?? 0;
        positions.set(date, position + 1);
        return { ...item, position };
      }),
  };
}

export function useItineraryEdit(tripId: string) {
  const [itinerary, setItinerary] = useState<Itinerary>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [routes, setRoutes] = useState<Record<string, TransitRoute | "loading">>({});
  const [undoing, setUndoing] = useState(false);

  const reload = useCallback(async () => {
    setError(undefined);
    try {
      const [nextItinerary, trip, nextPlaces] = await Promise.all([getItinerary(tripId), getTrip(tripId), listTravelPlaces(tripId)]);
      setItinerary(nextItinerary);
      setDates(enumerateDates(trip.startDate, trip.endDate));
      setPlaces(nextPlaces);
    } catch (caught) { setError(apiErrorMessage(caught)); }
  }, [tripId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const setPlacesForDate = (date: string, selectedPlaceIds: string[]) => {
    if (!itinerary) return;
    const selected = new Set(selectedPlaceIds);
    const currentItems = itinerary.items.filter((item) => item.date === date);
    const currentIds = new Set(currentItems.map((item) => item.savedPlaceId));

    const retainedItems = itinerary.items.filter((item) => item.date !== date || selected.has(item.savedPlaceId));
    const additions = places.filter((place) => selected.has(place.id) && !currentIds.has(place.id)).map((place, index) => ({
      id: `local:${date}:${place.id}`,
      savedPlaceId: place.id,
      placeName: place.name,
      address: place.address,
      date,
      position: currentItems.length + index,
      locked: false,
      source: "manual" as const,
      visitStatus: null,
      rating: null,
      review: null,
    }));

    const nextItems = [...retainedItems, ...additions];
    const placedIds = new Set(nextItems.map((item) => item.savedPlaceId));
    setItinerary(normalizePositions({ items: nextItems, unplaced: places.filter((place) => !placedIds.has(place.id)).map((place) => ({ savedPlaceId: place.id, placeName: place.name })) }));
  };

  const moveWithinDay = (itemId: string, direction: -1 | 1) => {
    if (!itinerary) return;
    const item = itinerary.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const sameDay = itinerary.items
      .filter((candidate) => candidate.date === item.date)
      .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    const index = sameDay.findIndex((candidate) => candidate.id === itemId);
    const target = sameDay[index + direction];
    if (!target) return;
    setItinerary(normalizePositions({
      ...itinerary,
      items: itinerary.items.map((candidate) => {
        if (candidate.id === item.id) return { ...candidate, position: target.position };
        if (candidate.id === target.id) return { ...candidate, position: item.position };
        return candidate;
      }),
    }));
  };

  const moveToAdjacentDay = (itemId: string, direction: -1 | 1) => {
    if (!itinerary) return;
    const item = itinerary.items.find((candidate) => candidate.id === itemId);
    const currentIndex = item?.date ? dates.indexOf(item.date) : -1;
    const nextDate = dates[currentIndex + direction];
    if (!item || !nextDate) return;
    setItinerary(normalizePositions({
      ...itinerary,
      items: itinerary.items.map((candidate) => candidate.id === itemId
        ? { ...candidate, date: nextDate, position: itinerary.items.filter((other) => other.date === nextDate).length }
        : candidate),
    }));
  };

  const removeFromItinerary = (itemId: string) => {
    if (!itinerary) return;
    const item = itinerary.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const nextItems = itinerary.items.filter((candidate) => candidate.id !== itemId);
    const stillPlaced = nextItems.some((candidate) => candidate.savedPlaceId === item.savedPlaceId);
    setItinerary(normalizePositions({ items: nextItems, unplaced: stillPlaced ? itinerary.unplaced : [...itinerary.unplaced, { savedPlaceId: item.savedPlaceId, placeName: item.placeName }] }));
  };

  const toggleLocked = (itemId: string) => {
    if (!itinerary) return;
    setItinerary({ ...itinerary, items: itinerary.items.map((item) => item.id === itemId ? { ...item, locked: !item.locked } : item) });
  };

  const loadTransitRoute = async (originSavedPlaceId: string, destinationSavedPlaceId: string) => {
    const key = `${originSavedPlaceId}:${destinationSavedPlaceId}`;
    setRoutes((current) => ({ ...current, [key]: "loading" }));
    try {
      const route = await getTransitRoute(tripId, originSavedPlaceId, destinationSavedPlaceId);
      setRoutes((current) => ({ ...current, [key]: route }));
    } catch (caught) {
      setError(apiErrorMessage(caught));
      setRoutes((current) => { const next = { ...current }; delete next[key]; return next; });
    }
  };

  const save = async () => {
    if (!itinerary) return false;
    setSaving(true); setError(undefined);
    try {
      setItinerary(await replaceItinerary(tripId, itinerary.items.map((item) => ({
        savedPlaceId: item.savedPlaceId, date: item.date!, position: item.position!, locked: item.locked,
      }))));
      return true;
    } catch (caught) { setError(apiErrorMessage(caught)); return false; } finally { setSaving(false); }
  };

  const undoAiChange = async () => {
    setUndoing(true); setError(undefined);
    try {
      const restored = await undoAiPlan(tripId);
      if (!restored) { setError("되돌릴 AI 변경이 없어요."); return; }
      setItinerary(restored);
    } catch (caught) { setError(apiErrorMessage(caught)); }
    finally { setUndoing(false); }
  };

  return { dates, error, itinerary, loadTransitRoute, moveToAdjacentDay, moveWithinDay, places, reload, removeFromItinerary, routes, save, saving, setPlacesForDate, toggleLocked, undoAiChange, undoing };
}
