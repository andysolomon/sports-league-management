import { US_BBOX, US_CITIES } from "./geo-cities";

/**
 * Pure geo helpers for the league map / regions list (WSM-000136 P5). Turn a
 * team's text `city`/`location` into a bundled coordinate (no external geocoder)
 * and an equirectangular projection into a US-aspect box. Kept pure so the map
 * widget stays presentational and these are unit-testable.
 */

export interface TeamLoc {
  name: string;
  city: string;
  location?: string | null;
}

export interface MapPoint {
  name: string;
  city: string;
  x: number;
  y: number;
}

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/** Bundled coordinate for a city name, or null if we don't have one. */
export function lookupCoords(city: string): { lat: number; lng: number } | null {
  return US_CITIES[normalizeCity(city)] ?? null;
}

/** Two-letter state code from a "City, ST" location string, or null. */
export function parseState(location: string | null | undefined): string | null {
  if (!location) return null;
  const m = location.match(/,\s*([A-Za-z]{2})\b/);
  return m ? m[1].toUpperCase() : null;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round = (n: number) => Math.round(n * 100) / 100;

/** Equirectangular projection of lat/lng into a width×height box (y inverted). */
export function projectUS(
  lat: number,
  lng: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const fx = clamp01((lng - US_BBOX.minLng) / (US_BBOX.maxLng - US_BBOX.minLng));
  const fy = clamp01((lat - US_BBOX.minLat) / (US_BBOX.maxLat - US_BBOX.minLat));
  return { x: round(fx * width), y: round((1 - fy) * height) };
}

/** Projected dots for every team whose city we can geocode. */
export function geocodedPoints(
  teams: TeamLoc[],
  width: number,
  height: number,
): MapPoint[] {
  const points: MapPoint[] = [];
  for (const t of teams) {
    const coords = lookupCoords(t.city);
    if (!coords) continue;
    const { x, y } = projectUS(coords.lat, coords.lng, width, height);
    points.push({ name: t.name, city: t.city, x, y });
  }
  return points;
}

export interface Region {
  region: string;
  count: number;
}

/**
 * Group teams into regions (Vercel-style list): by state code when the location
 * carries one, else by city. Sorted by count desc, then name.
 */
export function teamRegions(teams: TeamLoc[]): Region[] {
  const counts = new Map<string, number>();
  for (const t of teams) {
    const region = parseState(t.location) ?? t.city.trim() ?? "Unknown";
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  return Array.from(counts, ([region, count]) => ({ region, count })).sort(
    (a, b) => b.count - a.count || a.region.localeCompare(b.region),
  );
}
