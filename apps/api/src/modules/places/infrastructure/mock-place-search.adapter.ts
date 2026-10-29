import { Injectable } from '@nestjs/common';

import { PlaceSearchCandidate, PlaceSearchPort } from '../domain/place-search.port';

@Injectable()
export class MockPlaceSearchAdapter implements PlaceSearchPort {
  search(query: string, destination: string): Promise<PlaceSearchCandidate[]> {
    const normalized = query.trim();
    return Promise.resolve([
      {
        googlePlaceId: `mock:${destination}:${normalized}:1`,
        name: `${normalized} 추천 장소`,
        address: `${destination} 중심가`,
        primaryType: 'tourist_attraction',
        latitude: null,
        longitude: null,
      },
      {
        googlePlaceId: `mock:${destination}:${normalized}:2`,
        name: `${normalized} 로컬 맛집`,
        address: `${destination} 여행자 거리`,
        primaryType: 'restaurant',
        latitude: null,
        longitude: null,
      },
    ]);
  }
}
