export const ROUTES_PORT = Symbol('ROUTES_PORT');

export interface TransitRouteInput {
  originGooglePlaceId: string;
  destinationGooglePlaceId: string;
  departureTime?: string;
}

export interface TransitRouteEstimate {
  durationMinutes: number;
  distanceMeters: number | null;
}

export interface RoutesPort {
  transit(input: TransitRouteInput): Promise<TransitRouteEstimate | null>;
}
