import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getTrip } from "@/domains/trips";
import { getItinerary, getTransitRoute, replaceItinerary, type Itinerary, type TransitRoute } from "../../api/itineraries.api";

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
    items: itinerary.items
      .toSorted((left, right) => `${left.date}:${left.position}`.localeCompare(`${right.date}:${right.position}`))
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
  const [routes, setRoutes] = useState<Record<string, TransitRoute | "loading">>({});

  const reload = useCallback(async () => {
    setError(undefined);
    try {
      const [nextItinerary, trip] = await Promise.all([getItinerary(tripId), getTrip(tripId)]);
      setItinerary(nextItinerary);
      setDates(enumerateDates(trip.startDate, trip.endDate));
    } catch (caught) { setError(apiErrorMessage(caught)); }
  }, [tripId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const addUnplaced = (savedPlaceId: string) => {
    if (!itinerary) return;
    const firstDate = dates[0];
    if (!firstDate) return;
    setItinerary(normalizePositions({
      items: [...itinerary.items, {
        id: `local:${savedPlaceId}`, savedPlaceId, placeName: itinerary.unplaced.find((place) => place.savedPlaceId === savedPlaceId)?.placeName ?? "장소",
        address: null, date: firstDate, position: itinerary.items.filter((item) => item.date === firstDate).length,
        locked: false, source: "manual", visitStatus: null, rating: null, review: null,
      }],
      unplaced: itinerary.unplaced.filter((place) => place.savedPlaceId !== savedPlaceId),
    }));
  };

  const moveWithinDay = (itemId: string, direction: -1 | 1) => {
    if (!itinerary) return;
    const item = itinerary.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const sameDay = itinerary.items
      .filter((candidate) => candidate.date === item.date)
      .toSorted((left, right) => (left.position ?? 0) - (right.position ?? 0));
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
    setItinerary(normalizePositions({
      items: itinerary.items.filter((candidate) => candidate.id !== itemId),
      unplaced: [...itinerary.unplaced, { savedPlaceId: item.savedPlaceId, placeName: item.placeName }],
    }));
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

  return { addUnplaced, dates, error, itinerary, loadTransitRoute, moveToAdjacentDay, moveWithinDay, reload, removeFromItinerary, routes, save, saving };
}
