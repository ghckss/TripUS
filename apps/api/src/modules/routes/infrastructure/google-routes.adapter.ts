import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RoutesPort, TransitRouteEstimate, TransitRouteInput } from '../domain/routes.port';

interface GoogleRoutesResponse {
  routes?: Array<{ duration?: string; distanceMeters?: number }>;
}

@Injectable()
export class GoogleRoutesAdapter implements RoutesPort {
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('GOOGLE_MAPS_API_KEY');
  }

  async transit(input: TransitRouteInput): Promise<TransitRouteEstimate | null> {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { placeId: input.originGooglePlaceId },
        destination: { placeId: input.destinationGooglePlaceId },
        travelMode: 'TRANSIT',
        languageCode: 'ko',
        units: 'METRIC',
        ...(input.departureTime ? { departureTime: input.departureTime } : {}),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new ServiceUnavailableException(`Google Routes request failed (${response.status})`);
    const body = await response.json() as GoogleRoutesResponse;
    const route = body.routes?.[0];
    if (!route?.duration) return null;
    return {
      durationMinutes: Math.max(1, Math.ceil(Number.parseFloat(route.duration.replace('s', '')) / 60)),
      distanceMeters: route.distanceMeters ?? null,
    };
  }
}
