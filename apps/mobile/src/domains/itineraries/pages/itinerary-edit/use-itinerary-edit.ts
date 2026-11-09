import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getTrip } from "@/domains/trips";
import { listPlaces, type SavedPlace } from "@/domains/places/api/places.api";
import { getItinerary, replaceItinerary, undoAiPlan, type Itinerary } from "../../api/itineraries.api";
import { ensureLodgingEndpoints } from "./itinerary-lodging-endpoints";

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

function applySavedPlaceCoordinates(itinerary: Itinerary, places: SavedPlace[]): Itinerary {
  const coordinates = new Map(places.flatMap((place) => place.latitude != null && place.longitude != null
    ? [[place.id, { latitude: place.latitude, longitude: place.longitude }] as const]
    : []));
  return {
    ...itinerary,
    items: itinerary.items.map((item) => ({ ...item, ...coordinates.get(item.savedPlaceId) })),
  };
}

export function useItineraryEdit(tripId: string) {
  const [itinerary, setItinerary] = useState<Itinerary>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [undoing, setUndoing] = useState(false);

  const reload = useCallback(async () => {
    setError(undefined);
    try {
      const [nextItinerary, trip, nextPlaces] = await Promise.all([getItinerary(tripId), getTrip(tripId), listPlaces(tripId)]);
      const nextDates = enumerateDates(trip.startDate, trip.endDate);
      setItinerary(ensureLodgingEndpoints(applySavedPlaceCoordinates(nextItinerary, nextPlaces), nextDates, nextPlaces));
      setDates(nextDates);
      setPlaces(nextPlaces);
    } catch (caught) { setError(apiErrorMessage(caught)); }
  }, [tripId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const setPlacesForDate = (date: string, selectedPlaceIds: string[], availablePlaces = places) => {
    if (!itinerary) return;
    const selected = new Set(selectedPlaceIds);
    const currentItems = itinerary.items.filter((item) => item.date === date);
    const currentIds = new Set(currentItems.map((item) => item.savedPlaceId));
    const primaryLodgingId = availablePlaces.find((place) => place.isPrimaryLodging)?.id;

    const retainedItems = itinerary.items.filter((item) => item.date !== date || item.savedPlaceId === primaryLodgingId || selected.has(item.savedPlaceId));
    const additions = availablePlaces.filter((place) => selected.has(place.id) && !currentIds.has(place.id)).map((place, index) => ({
      id: `local:${date}:${place.id}`,
      savedPlaceId: place.id,
      placeName: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
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
    setPlaces(availablePlaces);
    setItinerary(ensureLodgingEndpoints({
      items: nextItems,
      unplaced: availablePlaces.filter((place) => !place.isPrimaryLodging && !placedIds.has(place.id)).map((place) => ({ savedPlaceId: place.id, placeName: place.name })),
    }, dates, availablePlaces));
  };

  const reorderWithinDay = (itemId: string, targetIndex: number) => {
    if (!itinerary) return;
    const item = itinerary.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const sameDay = itinerary.items
      .filter((candidate) => candidate.date === item.date)
      .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    const index = sameDay.findIndex((candidate) => candidate.id === itemId);
    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, sameDay.length - 1));
    if (index < 0 || index === boundedTargetIndex) return;
    const reordered = [...sameDay];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(boundedTargetIndex, 0, moved);
    const nextPositions = new Map(reordered.map((candidate, position) => [candidate.id, position]));
    setItinerary(normalizePositions({
      ...itinerary,
      items: itinerary.items.map((candidate) => nextPositions.has(candidate.id)
        ? { ...candidate, position: nextPositions.get(candidate.id)! }
        : candidate),
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

  const save = async () => {
    if (!itinerary) return false;
    setSaving(true); setError(undefined);
    try {
      const prepared = ensureLodgingEndpoints(itinerary, dates, places);
      setItinerary(await replaceItinerary(tripId, prepared.items.map((item) => ({
        savedPlaceId: item.savedPlaceId, date: item.date!, position: item.position!, locked: false,
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

  return { dates, error, itinerary, moveToAdjacentDay, places, reload, removeFromItinerary, reorderWithinDay, save, saving, setPlacesForDate, undoAiChange, undoing };
}
