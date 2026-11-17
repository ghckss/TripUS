import type { Itinerary, ItineraryItem } from "@/domains/itineraries";
import type { Trip } from "@/domains/trips";
import type { TripPhoto } from "../../api/photos.api";

export type RecapPhoto = TripPhoto & { uri: string };

export type RecapSlide =
  | { id: "cover"; kind: "cover"; title: string; subtitle: string; dayCount: number; placeCount: number; photos: RecapPhoto[] }
  | { id: string; kind: "day-schedule"; day: RecapDay }
  | { id: string; kind: "day-highlight"; day: RecapDay; place: ItineraryItem; photo: RecapPhoto };

export type RecapDay = {
  date: string;
  dayNumber: number;
  items: ItineraryItem[];
};

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
  return dates.map((date, index) => ({
    date,
    dayNumber: index + 1,
    items: [...(groups.get(date) ?? [])].sort((left, right) => (left.position ?? 0) - (right.position ?? 0)),
  }));
}

function highlightForDay(day: RecapDay, photos: RecapPhoto[]): { place: ItineraryItem; photo: RecapPhoto } | undefined {
  const photosByItemId = new Map(photos.flatMap((photo) => photo.itineraryItemId ? [[photo.itineraryItemId, photo] as const] : []));
  const candidates = day.items.flatMap((place) => {
    const photo = photosByItemId.get(place.id);
    return photo ? [{ place, photo }] : [];
  });
  if (candidates.length === 0) return undefined;

  return candidates.reduce((best, candidate) => {
    const bestRating = typeof best.place.rating === "number" ? best.place.rating : -1;
    const candidateRating = typeof candidate.place.rating === "number" ? candidate.place.rating : -1;
    return candidateRating > bestRating ? candidate : best;
  });
}

export function buildRecapSlides(input: {
  trip: Trip;
  itinerary: Itinerary;
  photos: TripPhoto[];
}): RecapSlide[] {
  const photos = readyPhotos(input.photos);
  const days = groupDays(input.trip, input.itinerary);
  const slides: RecapSlide[] = [{
    id: "cover",
    kind: "cover",
    title: input.trip.title,
    subtitle: `${input.trip.startDate} — ${input.trip.endDate}`,
    dayCount: days.length,
    placeCount: days.reduce((sum, day) => sum + day.items.length, 0),
    photos: photos.slice(0, 3),
  }];

  for (const day of days) {
    slides.push({ id: `day-${day.date}-schedule`, kind: "day-schedule", day });
    const highlight = highlightForDay(day, photos);
    if (highlight) slides.push({ id: `day-${day.date}-highlight`, kind: "day-highlight", day, ...highlight });
  }

  return slides;
}
