import { useQuery } from "@tanstack/react-query";
import { queryClient, resourceKey } from "@/shared/query/query-client";
import { getTransitLeg, type ItineraryItem, type TransitRouteRequest } from "../../api/itineraries.api";

export type TransitLegState = {
  status: "loading" | "available" | "unavailable";
  durationMinutes: number | null;
  retry: () => void;
};
type TransitLegResult = Omit<TransitLegState, "retry">;

/** Convert a known local departure time to an instant; never use the device's timezone. */
export function departureInstant(item: ItineraryItem, timezone?: string): string | undefined {
  if (!item.date || !item.scheduledTime || !timezone) return undefined;
  try {
    const wall = Date.parse(`${item.date}T${item.scheduledTime}:00Z`) + (item.durationMinutes ?? 0) * 60_000;
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    let instant = wall;
    for (let index = 0; index < 3; index += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
      const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
      const next = wall - (represented - instant);
      if (next === instant) break;
      instant = next;
    }
    return new Date(instant).toISOString();
  } catch { return undefined; }
}

export function transitLegRequest(origin: ItineraryItem, destination: ItineraryItem, timezone?: string): TransitRouteRequest {
  const departureTime = departureInstant(origin, timezone);
  return {
    ...(origin.boundaryType ? { originBoundaryType: origin.boundaryType } : { originSavedPlaceId: origin.savedPlaceId }),
    ...(destination.boundaryType ? { destinationBoundaryType: destination.boundaryType } : { destinationSavedPlaceId: destination.savedPlaceId }),
    ...(departureTime ? { departureTime } : {}),
  };
}

export function useTransitLeg(tripId: string, origin: ItineraryItem, destination: ItineraryItem, timezone?: string): TransitLegState {
  const request = transitLegRequest(origin, destination, timezone);
  // Direction, date, departure instant and trip all belong to the leg, not to the destination card.
  // Boundary IDs remain stable when the user edits an airport; its location must invalidate the cache too.
  const locations = [origin, destination].map((item) => [item.placeName, item.address, item.latitude, item.longitude]);
  const key = `trips:${tripId}:route:${JSON.stringify([origin.date, "transit", request, locations])}`;
  const query = useQuery({
    queryKey: resourceKey(key),
    queryFn: async (): Promise<TransitLegResult> => {
      const route = await getTransitLeg(tripId, request).catch(() => null);
      return route?.status === "available" && route.durationMinutes != null
        ? { status: "available", durationMinutes: route.durationMinutes }
        : { status: "unavailable", durationMinutes: null };
    },
    staleTime: (query) => query.state.data?.status === "available" ? 5 * 60_000 : 15_000,
    gcTime: 5 * 60_000,
    retry: false,
  }, queryClient);
  const retry = () => { void query.refetch(); };
  if (query.isFetching || query.isPending) return { status: "loading", durationMinutes: null, retry };
  return { ...(query.data ?? { status: "unavailable", durationMinutes: null }), retry };
}
