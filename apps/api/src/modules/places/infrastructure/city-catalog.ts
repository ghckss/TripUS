import type { PlaceSearchCandidate } from '../domain/place-search.port';
import { CITY_CATALOG } from './city-catalog.generated';

const POPULAR_CITY_LIMIT = 20;
const SEARCH_CITY_LIMIT = 30;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/\s+/g, '');
}

export function listCountryCities(countryCode: string, query: string): PlaceSearchCandidate[] {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  const normalizedQuery = normalize(query);
  const popularOnly = normalizedQuery === normalize('주요 도시');
  const cities = CITY_CATALOG.filter(([, entryCountryCode, canonicalName, koreanName]) =>
    entryCountryCode === normalizedCountryCode
    && (popularOnly
      || normalize(canonicalName).includes(normalizedQuery)
      || (koreanName !== null && normalize(koreanName).includes(normalizedQuery))),
  ).sort((left, right) => popularOnly ? Number(right[3] !== null) - Number(left[3] !== null) : 0);

  return cities.slice(0, popularOnly ? POPULAR_CITY_LIMIT : SEARCH_CITY_LIMIT).map((city) => ({
    googlePlaceId: `catalog:geonames:${city[0]}`,
    name: city[3] ?? city[2],
    address: null,
    primaryType: 'locality',
    latitude: city[4],
    longitude: city[5],
  }));
}
