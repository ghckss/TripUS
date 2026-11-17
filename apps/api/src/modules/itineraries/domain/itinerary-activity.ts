/** Non-place events. A transport event's duration includes the entire leg, exactly once. */
export const ITINERARY_ACTIVITY_TYPES = ['arrival', 'departure', 'transport', 'check_in', 'check_out', 'luggage', 'rest', 'waiting'] as const;
export type ItineraryActivityType = typeof ITINERARY_ACTIVITY_TYPES[number];
export const ACTIVITY_LOCATION_TYPES = ['lodging', 'start_point', 'end_point', 'other'] as const;
export interface ItineraryActivity {
  id: string;
  date: string;
  position: number;
  type: ItineraryActivityType;
  title: string;
  startTime: string;
  durationMinutes: number;
  locationType: typeof ACTIVITY_LOCATION_TYPES[number] | null;
  savedPlaceId: string | null;
  locationName: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  travelMethod: string | null;
}

/** Only persisted activity fields belong in the current API; discard retired JSON fields. */
export function serializeItineraryActivity(activity: ItineraryActivity): ItineraryActivity {
  const { id, date, position, type, title, startTime, durationMinutes, locationType,
    savedPlaceId, locationName, fromLocation, toLocation, travelMethod } = activity;
  return { id, date, position, type, title, startTime, durationMinutes, locationType,
    savedPlaceId, locationName, fromLocation, toLocation, travelMethod };
}
