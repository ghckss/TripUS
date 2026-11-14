export const PLACE_SEARCH_PORT = Symbol('PLACE_SEARCH_PORT');

export interface PlaceOpeningPeriodPoint {
  day: number;
  hour: number;
  minute: number;
}

export interface PlaceOpeningPeriod {
  open: PlaceOpeningPeriodPoint;
  close?: PlaceOpeningPeriodPoint;
}

export interface PlaceSchedulingDetails {
  primaryType: string | null;
  regularOpeningHours: {
    periods: PlaceOpeningPeriod[];
    weekdayDescriptions: string[];
  } | null;
  utcOffsetMinutes: number | null;
}

export interface PlaceSearchCandidate {
  googlePlaceId: string;
  name: string;
  address: string | null;
  primaryType: string | null;
  latitude: number | null;
  longitude: number | null;
  regularOpeningHours?: PlaceSchedulingDetails['regularOpeningHours'];
  utcOffsetMinutes?: number | null;
}

export interface PlacePhoto {
  imageUrl: string;
  googleMapsUri: string;
  authorNames: string[];
}

export interface PlaceSearchPort {
  search(query: string, destination: string): Promise<PlaceSearchCandidate[]>;
  getCoordinates(googlePlaceId: string): Promise<{ latitude: number; longitude: number } | null>;
  getPrimaryType?(googlePlaceId: string): Promise<string | null>;
  getSchedulingDetails?(googlePlaceId: string): Promise<PlaceSchedulingDetails | null>;
  getPhoto(googlePlaceId: string): Promise<PlacePhoto | null>;
}
