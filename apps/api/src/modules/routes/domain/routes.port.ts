export const ROUTES_PORT = Symbol('ROUTES_PORT');

export type RouteTravelMode = 'public_transit' | 'walking' | 'car';

export interface TransitRouteInput {
  originGooglePlaceId: string;
  destinationGooglePlaceId: string;
  departureTime?: string;
  fallbackTravelModes?: Array<Exclude<RouteTravelMode, 'public_transit'>>;
}

export interface TransitRouteEstimate {
  durationMinutes: number;
  distanceMeters: number | null;
  travelMode: RouteTravelMode;
  isFallback: boolean;
}

export interface RoutesPort {
  transit(input: TransitRouteInput): Promise<TransitRouteEstimate | null>;
}
