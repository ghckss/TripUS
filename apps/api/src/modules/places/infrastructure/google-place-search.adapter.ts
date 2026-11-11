import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PlaceSearchCandidate, PlaceSearchPort } from '../domain/place-search.port';

interface GoogleTextSearchResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    primaryType?: string;
    location?: { latitude?: number; longitude?: number };
  }>;
}

@Injectable()
export class GooglePlaceSearchAdapter implements PlaceSearchPort {
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');
  }

  async search(query: string, destination: string): Promise<PlaceSearchCandidate[]> {
    return this.textSearch({ textQuery: `${query} ${destination}`, languageCode: 'ko', pageSize: 10 });
  }

  private async textSearch(requestBody: Record<string, unknown>): Promise<PlaceSearchCandidate[]> {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.location',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(`Google Places request failed (${response.status})`);
    }
    const responseBody = await response.json() as GoogleTextSearchResponse;
    return (responseBody.places ?? []).flatMap((place) => place.id && place.displayName?.text ? [{
      googlePlaceId: place.id,
      name: place.displayName.text,
      address: place.formattedAddress ?? null,
      primaryType: place.primaryType ?? null,
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
    }] : []);
  }

  async getCoordinates(googlePlaceId: string): Promise<{ latitude: number; longitude: number } | null> {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}?languageCode=ko`, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'location',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new ServiceUnavailableException(`Google Place Details request failed (${response.status})`);
    const body = await response.json() as { location?: { latitude?: number; longitude?: number } };
    const { latitude, longitude } = body.location ?? {};
    return latitude === undefined || longitude === undefined ? null : { latitude, longitude };
  }
}
