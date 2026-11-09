export const PLACE_SEARCH_PORT = Symbol('PLACE_SEARCH_PORT');

export interface PlaceSearchCandidate {
  googlePlaceId: string;
  name: string;
  address: string | null;
  primaryType: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PlaceSearchPort {
  search(query: string, destination: string): Promise<PlaceSearchCandidate[]>;
  getCoordinates(googlePlaceId: string): Promise<{ latitude: number; longitude: number } | null>;
}
