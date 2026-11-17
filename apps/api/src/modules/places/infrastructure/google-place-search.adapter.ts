import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  PlaceSearchBounds,
  PlacePhoto,
  PlaceSearchCandidate,
  PlaceSchedulingDetails,
  PlaceSearchPort,
} from '../domain/place-search.port';

interface GoogleTextSearchResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    primaryType?: string;
    location?: { latitude?: number; longitude?: number };
    regularOpeningHours?: PlaceSchedulingDetails['regularOpeningHours'];
    utcOffsetMinutes?: number;
  }>;
}

interface GooglePlaceDetailsResponse {
  photos?: Array<{
    name?: string;
    googleMapsUri?: string;
    authorAttributions?: Array<{ displayName?: string }>;
  }>;
}

@Injectable()
export class GooglePlaceSearchAdapter implements PlaceSearchPort {
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');
  }

  async search(query: string, destination: string, bounds?: PlaceSearchBounds): Promise<PlaceSearchCandidate[]> {
    const candidates = await this.textSearch({
      textQuery: bounds ? query : `${query} ${destination}`,
      languageCode: 'ko', pageSize: 10,
      ...(bounds ? { locationRestriction: { rectangle: {
        low: { latitude: bounds.south, longitude: bounds.west },
        high: { latitude: bounds.north, longitude: bounds.east },
      } } } : {}),
    });
    // Specific address queries can ignore Google's restriction. Keep map results inside the viewport.
    return bounds ? candidates.filter(({ latitude, longitude }) => latitude != null && longitude != null &&
      latitude >= bounds.south && latitude <= bounds.north &&
      (bounds.west <= bounds.east ? longitude >= bounds.west && longitude <= bounds.east : longitude >= bounds.west || longitude <= bounds.east)) : candidates;
  }

  private async textSearch(requestBody: Record<string, unknown>): Promise<PlaceSearchCandidate[]> {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.location,places.regularOpeningHours,places.utcOffsetMinutes',
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
      regularOpeningHours: place.regularOpeningHours ?? null,
      utcOffsetMinutes: place.utcOffsetMinutes ?? null,
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

  async getPrimaryType(googlePlaceId: string): Promise<string | null> {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}?languageCode=ko`, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'primaryType',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new ServiceUnavailableException(`Google Place Details request failed (${response.status})`);
    const body = await response.json() as { primaryType?: string };
    return body.primaryType ?? null;
  }

  async getSchedulingDetails(googlePlaceId: string): Promise<PlaceSchedulingDetails | null> {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}?languageCode=ko`, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'primaryType,regularOpeningHours,utcOffsetMinutes',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new ServiceUnavailableException(`Google Place Details request failed (${response.status})`);
    const body = await response.json() as {
      primaryType?: string;
      regularOpeningHours?: PlaceSchedulingDetails['regularOpeningHours'];
      utcOffsetMinutes?: number;
    };
    return {
      primaryType: body.primaryType ?? null,
      regularOpeningHours: body.regularOpeningHours ?? null,
      utcOffsetMinutes: body.utcOffsetMinutes ?? null,
    };
  }

  async getPhoto(googlePlaceId: string, dimensions = { maxWidthPx: 320, maxHeightPx: 240 }): Promise<PlacePhoto | null> {
    const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}?languageCode=ko`, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'photos.name,photos.authorAttributions,photos.googleMapsUri',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!detailsResponse.ok) throw new ServiceUnavailableException(`Google Place Details request failed (${detailsResponse.status})`);
    const details = await detailsResponse.json() as GooglePlaceDetailsResponse;
    const photo = details.photos?.find((candidate) => candidate.name);
    if (!photo?.name || !photo.googleMapsUri) return null;

    const mediaUrl = new URL(`https://places.googleapis.com/v1/${photo.name}/media`);
    mediaUrl.searchParams.set('maxWidthPx', String(dimensions.maxWidthPx));
    mediaUrl.searchParams.set('maxHeightPx', String(dimensions.maxHeightPx));
    mediaUrl.searchParams.set('skipHttpRedirect', 'true');
    mediaUrl.searchParams.set('key', this.apiKey);
    const mediaResponse = await fetch(mediaUrl, { signal: AbortSignal.timeout(8_000) });
    if (!mediaResponse.ok) throw new ServiceUnavailableException(`Google Place Photo request failed (${mediaResponse.status})`);
    const media = await mediaResponse.json() as { photoUri?: string };
    if (!media.photoUri) return null;
    return {
      imageUrl: media.photoUri,
      googleMapsUri: photo.googleMapsUri,
      authorNames: (photo.authorAttributions ?? []).flatMap((author) => author.displayName ? [author.displayName] : []),
    };
  }
}
