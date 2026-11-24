import { Injectable } from '@nestjs/common';

import { RoutesPort, TransitRouteEstimate, TransitRouteInput } from '../domain/routes.port';

@Injectable()
export class MockRoutesAdapter implements RoutesPort {
  transit(input: TransitRouteInput): Promise<TransitRouteEstimate> {
    const seed = [...input.originGooglePlaceId, ...input.destinationGooglePlaceId]
      .reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return Promise.resolve({
      durationMinutes: 15 + seed % 31,
      distanceMeters: 2_000 + seed % 8_001,
      travelMode: 'public_transit',
      isFallback: false,
    });
  }
}
