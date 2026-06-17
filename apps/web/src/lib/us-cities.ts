/*
 * US cities dataset for the team-location pick lists + map placement
 * (WSM-000136). Source: US Census 2023 Gazetteer "places" file — US government
 * work, public domain (no attribution/licensing constraint, no scraping).
 *
 * ~31.7k cities across the 50 states + DC, keyed by state code. The ~1.4 MB JSON
 * is served from /public and lazy-fetched (cached per session), never bundled —
 * same posture as the county geometry.
 */

export interface City {
  /** City name with the legal/statistical suffix stripped (e.g. "Marietta"). */
  n: string;
  lat: number;
  lng: number;
}

export type CitiesByState = Record<string, City[]>;

/** 50 states + DC, code → display name, sorted by name (for the State select). */
export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const STATE_NAME = new Map(US_STATES.map((s) => [s.code, s.name]));
const STATE_CODE = new Map(US_STATES.map((s) => [s.name, s.code]));

export function stateName(code: string): string | null {
  return STATE_NAME.get(code) ?? null;
}

export function stateCode(name: string): string | null {
  return STATE_CODE.get(name) ?? null;
}

let citiesCache: CitiesByState | null = null;

/**
 * Load + cache the cities dataset once. Imported as a code-split chunk (served
 * from /_next/static) rather than fetched from /public — the dynamic import
 * keeps it out of the initial bundle while being reliable on any host.
 */
export async function loadCities(): Promise<CitiesByState> {
  if (citiesCache) return citiesCache;
  const mod = await import("@/data/us-cities.json");
  citiesCache = (mod.default ?? mod) as unknown as CitiesByState;
  return citiesCache;
}

export function citiesForState(data: CitiesByState, code: string): City[] {
  return data[code] ?? [];
}

/** Coordinate for a (state, city) pair — exact, then case-insensitive. */
export function cityCoords(
  data: CitiesByState,
  code: string,
  name: string,
): { lat: number; lng: number } | null {
  const list = data[code];
  if (!list) return null;
  const target = name.trim().toLowerCase();
  const hit =
    list.find((c) => c.n === name) ??
    list.find((c) => c.n.toLowerCase() === target);
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}
