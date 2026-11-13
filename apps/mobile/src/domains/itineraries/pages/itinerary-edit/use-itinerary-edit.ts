import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getTrip } from "@/domains/trips";
import { listPlaces, type SavedPlace } from "@/domains/places/api/places.api";
import { generateAiPlanDay, getItinerary, isItineraryBoundary, replaceItinerary, type Itinerary } from "../../api/itineraries.api";
import { ensureLodgingEndpoints, isLodgingPlace, replaceLodgingBoundary, type LodgingEdge } from "./itinerary-lodging-endpoints";
import { reorderItineraryWithinDay } from "./itinerary-reorder";

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
  const [updatingDate, setUpdatingDate] = useState<string>();

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
    const placesById = new Map(availablePlaces.map((place) => [place.id, place]));
    const currentItems = itinerary.items
      .filter((item) => item.date === date)
      .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    const dateIndex = dates.indexOf(date);
    const endpointItemIds = new Set([
      ...currentItems.filter(isItineraryBoundary).map((item) => item.id),
      ...(dateIndex > 0 && isLodgingPlace(currentItems[0]?.savedPlaceId ? placesById.get(currentItems[0].savedPlaceId) : undefined) ? [currentItems[0].id] : []),
      ...(dateIndex < dates.length - 1 && isLodgingPlace(currentItems.at(-1)?.savedPlaceId ? placesById.get(currentItems.at(-1)!.savedPlaceId) : undefined) ? [currentItems.at(-1)!.id] : []),
    ]);
    const currentVisitIds = new Set(currentItems.filter((item) => !endpointItemIds.has(item.id)).map((item) => item.savedPlaceId));

    const retainedItems = itinerary.items.filter((item) => item.date !== date || endpointItemIds.has(item.id) || selected.has(item.savedPlaceId));
    const additions = availablePlaces.filter((place) => selected.has(place.id) && !currentVisitIds.has(place.id)).map((place, index) => ({
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
      unplaced: availablePlaces.filter((place) => !isLodgingPlace(place) && !placedIds.has(place.id)).map((place) => ({ savedPlaceId: place.id, placeName: place.name })),
    }, dates, availablePlaces));
  };

  const replaceDayLodging = (date: string, edge: LodgingEdge, place: SavedPlace, availablePlaces = places) => {
    const nextPlaces = availablePlaces.some((candidate) => candidate.id === place.id)
      ? availablePlaces
      : [place, ...availablePlaces];
    setPlaces(nextPlaces);
    setItinerary((current) => current ? replaceLodgingBoundary(current, dates, date, edge, place) : current);
  };

  const reorderWithinDay = (itemId: string, targetIndex: number) => {
    setItinerary((current) => current ? reorderItineraryWithinDay(current, itemId, targetIndex) : current);
  };

  const moveToAdjacentDay = (itemId: string, direction: -1 | 1) => {
    setItinerary((current) => {
      if (!current) return current;
      const item = current.items.find((candidate) => candidate.id === itemId);
      const currentIndex = item?.date ? dates.indexOf(item.date) : -1;
      const nextDate = dates[currentIndex + direction];
      if (!item || !nextDate || isItineraryBoundary(item)) return current;
      return normalizePositions({
        ...current,
        items: current.items.map((candidate) => candidate.id === itemId
          ? { ...candidate, date: nextDate, position: current.items.filter((other) => other.date === nextDate).length }
          : candidate),
      });
    });
  };

  const removeFromItinerary = (itemId: string) => {
    if (!itinerary) return;
    const item = itinerary.items.find((candidate) => candidate.id === itemId);
    if (!item || isItineraryBoundary(item)) return;
    const nextItems = itinerary.items.filter((candidate) => candidate.id !== itemId);
    const stillPlaced = nextItems.some((candidate) => candidate.savedPlaceId === item.savedPlaceId);
    setItinerary(normalizePositions({ items: nextItems, unplaced: stillPlaced ? itinerary.unplaced : [...itinerary.unplaced, { savedPlaceId: item.savedPlaceId, placeName: item.placeName }] }));
  };

  const save = async () => {
    if (!itinerary) return false;
    setSaving(true); setError(undefined);
    try {
      const prepared = ensureLodgingEndpoints(itinerary, dates, places);
      setItinerary(await replaceItinerary(tripId, serializeItineraryItems(prepared)));
      return true;
    } catch (caught) { setError(apiErrorMessage(caught)); return false; } finally { setSaving(false); }
  };

  const updateDayWithAi = async (date: string) => {
    if (!itinerary || updatingDate) return false;
    setUpdatingDate(date); setError(undefined);
    try {
      const prepared = ensureLodgingEndpoints(itinerary, dates, places);
      await replaceItinerary(tripId, serializeItineraryItems(prepared));
      const updated = await generateAiPlanDay(tripId, date);
      const nextPlaces = await listPlaces(tripId);
      setPlaces(nextPlaces);
      setItinerary(ensureLodgingEndpoints(applySavedPlaceCoordinates(updated, nextPlaces), dates, nextPlaces));
      return true;
    } catch (caught) { setError(apiErrorMessage(caught)); return false; }
    finally { setUpdatingDate(undefined); }
  };

  return { dates, error, itinerary, moveToAdjacentDay, places, reload, removeFromItinerary, reorderWithinDay, replaceDayLodging, save, saving, setPlacesForDate, updateDayWithAi, updatingDate };
}

function serializeItineraryItems(itinerary: Itinerary) {
  return itinerary.items.filter((item) => !isItineraryBoundary(item)).map((item) => ({
    savedPlaceId: item.savedPlaceId, date: item.date!, position: item.position!, locked: false,
    ...(item.scheduledTime ? { scheduledTime: item.scheduledTime } : {}),
    ...(item.durationMinutes ? { durationMinutes: item.durationMinutes } : {}),
    ...(item.activitySummary ? { activitySummary: item.activitySummary } : {}),
    ...(item.travelMethod ? { travelMethod: item.travelMethod } : {}),
    ...(item.travelDurationMinutes != null ? { travelDurationMinutes: item.travelDurationMinutes } : {}),
  }));
}
