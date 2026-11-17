import { Inject, Injectable } from '@nestjs/common';

import { PLACE_SEARCH_PORT, type PlaceSearchPort } from '../../places/domain/place-search.port';
import { PlacePhotoResponseDto } from '../../places/application/dto/place-photo-response.dto';
import { TripsService } from './trips.service';

@Injectable()
export class TripCoverService {
  constructor(
    @Inject(TripsService) private readonly trips: TripsService,
    @Inject(PLACE_SEARCH_PORT) private readonly places: PlaceSearchPort,
  ) {}

  async get(tripId: string): Promise<PlacePhotoResponseDto> {
    // Ownership and active status must be checked before any Google request.
    const trip = await this.trips.get(tripId);
    const empty = { imageUrl: null, googleMapsUri: null, authorNames: [] };
    const city = trip.regions[0];
    if (!city) return empty;
    try {
      let placeId = city.googlePlaceId;
      if (!placeId || placeId.startsWith('catalog:')) {
        const matches = await this.places.search(city.name, trip.destination);
        placeId = matches.find((place) => place.primaryType === 'locality')?.googlePlaceId ?? null;
      }
      if (!placeId || placeId.startsWith('mock:')) return empty;
      return await this.places.getPhoto(placeId, { maxWidthPx: 1000, maxHeightPx: 600 }) ?? empty;
    } catch {
      // An unavailable cover must not prevent browsing trips.
      return empty;
    }
  }
}
