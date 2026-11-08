import { getCountry } from "countries-and-timezones";
import countries from "world-countries";

export type TravelCountry = {
  code: string;
  name: string;
  englishName: string;
  flag: string;
  timezone: string;
};

const representativeTimezones: Record<string, string> = {
  AU: "Australia/Sydney",
  BR: "America/Sao_Paulo",
  CA: "America/Toronto",
  CL: "America/Santiago",
  CN: "Asia/Shanghai",
  EC: "America/Guayaquil",
  ES: "Europe/Madrid",
  FM: "Pacific/Pohnpei",
  GL: "America/Nuuk",
  ID: "Asia/Jakarta",
  KI: "Pacific/Tarawa",
  KZ: "Asia/Almaty",
  MX: "America/Mexico_City",
  MN: "Asia/Ulaanbaatar",
  MY: "Asia/Kuala_Lumpur",
  NZ: "Pacific/Auckland",
  PF: "Pacific/Tahiti",
  PG: "Pacific/Port_Moresby",
  PT: "Europe/Lisbon",
  RU: "Europe/Moscow",
  UA: "Europe/Kyiv",
  UM: "Pacific/Wake",
  US: "America/New_York",
};

export const travelCountries: TravelCountry[] = countries
  .flatMap((country) => {
    const timezone = representativeTimezones[country.cca2] ?? getCountry(country.cca2)?.timezones[0];
    if (!timezone) return [];
    return [{
      code: country.cca2,
      name: country.translations.kor?.common ?? country.name.common,
      englishName: country.name.common,
      flag: country.flag,
      timezone,
    }];
  })
  .sort((left, right) => left.name.localeCompare(right.name, "ko"));

export const defaultTravelCountry = travelCountries.find((country) => country.code === "KR") ?? travelCountries[0];

export function resolveTravelCountry(destination: string, timezone?: string): TravelCountry {
  const normalized = destination.trim().toLocaleLowerCase();
  return travelCountries.find((country) =>
    country.name.toLocaleLowerCase() === normalized
    || country.englishName.toLocaleLowerCase() === normalized
    || country.code.toLocaleLowerCase() === normalized,
  ) ?? travelCountries.find((country) => country.timezone === timezone)
    ?? defaultTravelCountry;
}

export function searchTravelCountries(query: string): TravelCountry[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return travelCountries;
  return travelCountries.filter((country) =>
    country.name.toLocaleLowerCase().includes(normalized)
    || country.englishName.toLocaleLowerCase().includes(normalized)
    || country.code.toLocaleLowerCase().includes(normalized),
  );
}
