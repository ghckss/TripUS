import type { Itinerary, ItineraryItem } from "@/domains/itineraries";
import type { Trip } from "@/domains/trips";
import type { TripPhoto } from "../../api/photos.api";

export type RecapMode = "photo-diary" | "mixed" | "route";

export type RecapPhoto = TripPhoto & { uri: string };

export type RecapSlide =
  | { id: "cover"; kind: "cover"; title: string; subtitle: string; photos: RecapPhoto[] }
  | { id: "route"; kind: "route"; title: string; days: RecapDay[] }
  | { id: string; kind: "day"; day: RecapDay; photos: RecapPhoto[] }
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

export function recapModeLabel(mode: RecapMode): string {
  if (mode === "photo-diary") return "사진 일기형";
  if (mode === "mixed") return "사진 + 동선형";
  return "동선 중심형";
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

function groupDays(itinerary: Itinerary): RecapDay[] {
  const groups = new Map<string, ItineraryItem[]>();
  itinerary.items
    .filter((item) => item.date && item.visitStatus !== "not_visited")
    .forEach((item) => {
      const date = item.date!;
      const group = groups.get(date) ?? [];
      group.push(item);
      groups.set(date, group);
    });

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 7)
    .map(([date, items], index) => {
      const sorted = [...items].sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
      const reviewed = sorted.find((item) => item.review?.trim());
      const ratings = sorted.flatMap((item) => typeof item.rating === "number" ? [item.rating] : []);
      return {
        date,
        dayNumber: index + 1,
        items: sorted,
        memory: reviewed?.review?.trim() || undefined,
        rating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : undefined,
      };
    });
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
  const days = groupDays(input.itinerary);
  const photoLimit = input.mode === "photo-diary" ? 4 : input.mode === "mixed" ? 2 : 0;
  const title = input.trip.title;
  const subtitle = `${input.trip.startDate} — ${input.trip.endDate}`;
  const slides: RecapSlide[] = [
    { id: "cover", kind: "cover", title, subtitle, photos: photos.slice(0, input.mode === "route" ? 0 : 3) },
    { id: "route", kind: "route", title: "우리가 걸었던 여행", days },
    ...days.map((day) => ({
      id: `day-${day.date}`,
      kind: "day" as const,
      day,
      photos: photosForDay(day, photos, photoLimit),
    })),
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
