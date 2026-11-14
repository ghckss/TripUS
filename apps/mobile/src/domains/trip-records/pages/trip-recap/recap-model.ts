import type { Itinerary, ItineraryItem } from "@/domains/itineraries";
import type { Trip } from "@/domains/trips";
import type { TripPhoto } from "../../api/photos.api";

export type RecapMode = "photo-diary" | "mixed" | "route";

export type RecapPhoto = TripPhoto & { uri: string };

export type RecapSlide =
  | { id: "cover"; kind: "cover"; title: string; subtitle: string; dayCount: number; placeCount: number; photos: RecapPhoto[] }
  | { id: string; kind: "route"; title: string; days: RecapDay[]; partNumber: number; partCount: number }
  | { id: string; kind: "day"; day: RecapDay; photos: RecapPhoto[]; partNumber: number; partCount: number }
  | { id: "favorites"; kind: "favorites"; title: string; places: ItineraryItem[]; photoCount: number; photos: RecapPhoto[] };

export type RecapDay = {
  date: string;
  dayNumber: number;
  items: ItineraryItem[];
  memory?: string;
  rating?: number;
};

export function recommendedRecapMode(photoCount: number): RecapMode {
  if (photoCount >= 6) return "photo-diary";
  if (photoCount > 0) return "mixed";
  return "route";
}

function photoUri(photo: TripPhoto): string | undefined {
  return photo.optimizedUrl ?? photo.originalUrl ?? photo.thumbnailUrl ?? undefined;
}

function readyPhotos(photos: TripPhoto[]): RecapPhoto[] {
  return photos.flatMap((photo) => {
    const uri = photoUri(photo);
    return uri ? [{ ...photo, uri }] : [];
  });
}

function tripDates(trip: Trip): string[] {
  const start = new Date(`${trip.startDate}T00:00:00.000Z`);
  const end = new Date(`${trip.endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 366) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function groupDays(trip: Trip, itinerary: Itinerary): RecapDay[] {
  const groups = new Map<string, ItineraryItem[]>();
  itinerary.items
    .filter((item) => item.date && item.visitStatus !== "not_visited")
    .forEach((item) => {
      const date = item.date!;
      const group = groups.get(date) ?? [];
      group.push(item);
      groups.set(date, group);
    });

  const dates = [...new Set([...tripDates(trip), ...groups.keys()])].sort((left, right) => left.localeCompare(right));
  return dates.map((date, index) => summarizeDay(date, index + 1, groups.get(date) ?? []));
}

function summarizeDay(date: string, dayNumber: number, items: ItineraryItem[]): RecapDay {
  const sorted = [...items].sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const reviewed = sorted.find((item) => item.review?.trim());
  const ratings = sorted.flatMap((item) => typeof item.rating === "number" ? [item.rating] : []);
  return {
    date,
    dayNumber,
    items: sorted,
    memory: reviewed?.review?.trim() || undefined,
    rating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : undefined,
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function photosForDay(day: RecapDay, photos: RecapPhoto[], limit: number): RecapPhoto[] {
  const itemIds = new Set(day.items.map((item) => item.id));
  return photos.filter((photo) => photo.itineraryItemId && itemIds.has(photo.itineraryItemId)).slice(0, limit);
}

export function buildRecapSlides(input: {
  trip: Trip;
  itinerary: Itinerary;
  photos: TripPhoto[];
  mode: RecapMode;
}): RecapSlide[] {
  const photos = readyPhotos(input.photos);
  const days = groupDays(input.trip, input.itinerary);
  const photoLimit = input.mode === "photo-diary" ? 4 : input.mode === "mixed" ? 2 : 0;
  const title = input.trip.title;
  const subtitle = `${input.trip.startDate} — ${input.trip.endDate}`;
  const placeCount = days.reduce((sum, day) => sum + day.items.length, 0);
  const routeParts = chunks(days, 3);
  const routeSlides: RecapSlide[] = routeParts.map((part, index) => ({
    id: `route-${index + 1}`,
    kind: "route",
    title: "우리가 걸었던 여행",
    days: part,
    partNumber: index + 1,
    partCount: routeParts.length,
  }));
  const daySlides: RecapSlide[] = days.flatMap((day) => {
    const itemParts = chunks(day.items, 3);
    return itemParts.map((items, index) => {
      const pageDay = summarizeDay(day.date, day.dayNumber, items);
      return {
        id: `day-${day.date}-${index + 1}`,
        kind: "day" as const,
        day: pageDay,
        photos: photosForDay(pageDay, photos, photoLimit),
        partNumber: index + 1,
        partCount: itemParts.length,
      };
    });
  });
  const slides: RecapSlide[] = [
    { id: "cover", kind: "cover", title, subtitle, dayCount: days.length, placeCount, photos: photos.slice(0, input.mode === "route" ? 0 : 3) },
    ...routeSlides,
    ...daySlides,
  ];

  const ratedPlaces = input.itinerary.items
    .filter((item) => item.visitStatus === "rated")
    .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))
    .slice(0, 3);
  slides.push({
    id: "favorites",
    kind: "favorites",
    title: "이번 여행의 베스트",
    places: ratedPlaces.length ? ratedPlaces : input.itinerary.items.filter((item) => item.visitStatus !== "not_visited").slice(0, 3),
    photoCount: photos.length,
    photos: photos.slice(-3),
  });
  return slides;
}
