import {
  geoAlbersUsa,
  geoMercator,
  geoPath,
  geoContains,
  type GeoProjection,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { lookupCoords, parseState, type TeamLoc } from "./geo";
import statesTopo from "./geo/us-states-10m.json";

/*
 * Drill-down engine for the league map (WSM-000148): US → counties → cities.
 *
 * Pure + isomorphic except `loadCounties` (a browser fetch). The US state
 * geometry is bundled (small, needed for the default view); the ~800 KB county
 * geometry is lazy-fetched from /public on the first state-drill so it never
 * touches the initial bundle. Team→region placement uses d3-geo `geoContains`
 * on each team's existing city coordinate — no city→county lookup table.
 */

type Topology = Parameters<typeof feature>[0];
type TopoObject = Parameters<typeof feature>[1];

const statesTopology = statesTopo as unknown as Topology;

/** All US states as a GeoJSON FeatureCollection (ids = 2-digit FIPS strings). */
export const STATES = feature(
  statesTopology,
  statesTopology.objects.states as TopoObject,
) as unknown as FeatureCollection<Geometry, { name?: string }>;

/** A drawable region (a state or a county) with its FIPS id + display name. */
export interface RegionFeature {
  /** FIPS id: 2 digits for a state, 5 for a county (first 2 = its state). */
  id: string;
  name: string;
  feature: Feature<Geometry, { name?: string }>;
}

const round = (n: number) => Math.round(n * 100) / 100;

function toRegion(f: Feature<Geometry, { name?: string }>): RegionFeature {
  return { id: String(f.id), name: f.properties?.name ?? "", feature: f };
}

/** Every US state as a RegionFeature (the top drill level). */
export function statesAsRegions(): RegionFeature[] {
  return STATES.features.map(toRegion);
}

export function findState(stateFips: string): RegionFeature | null {
  const f = STATES.features.find((s) => String(s.id) === stateFips);
  return f ? toRegion(f) : null;
}

// --- Lazy county geometry (browser only) -----------------------------------

let countiesCache: FeatureCollection<Geometry, { name?: string }> | null = null;

/**
 * Load + decode the county geometry once, caching it for the session. Imported
 * as a code-split chunk (served from /_next/static), keeping it out of the
 * initial bundle while being reliable on any host.
 */
export async function loadCounties(): Promise<
  FeatureCollection<Geometry, { name?: string }>
> {
  if (countiesCache) return countiesCache;
  const mod = await import("@/data/counties-10m.json");
  const topo = (mod.default ?? mod) as unknown as Topology;
  countiesCache = feature(
    topo,
    topo.objects.counties as TopoObject,
  ) as unknown as FeatureCollection<Geometry, { name?: string }>;
  return countiesCache;
}

/** The counties of one state (FIPS prefix match), as RegionFeatures. */
export function countiesForState(
  counties: FeatureCollection<Geometry, { name?: string }>,
  stateFips: string,
): RegionFeature[] {
  return counties.features
    .filter((f) => String(f.id).slice(0, 2) === stateFips)
    .map(toRegion)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// --- Team placement ---------------------------------------------------------

export interface LocatedTeam {
  name: string;
  city: string;
  lng: number;
  lat: number;
}

/** Resolve a (city, state) to coordinates — e.g. backed by the full US cities
 *  dataset. Returns null when unknown, so locateTeams falls back to the bundled
 *  metro lookup. */
export type CoordsResolver = (
  city: string,
  state: string | null,
) => { lat: number; lng: number } | null;

/**
 * Teams whose city resolves to a coordinate (the only ones that can be drawn).
 * An optional `resolve` (the full cities dataset) is tried first, keyed by the
 * team's city + parsed state; the bundled metro lookup is the fallback so the
 * map still renders before the full dataset loads.
 */
export function locateTeams(
  teams: TeamLoc[],
  resolve?: CoordsResolver,
): LocatedTeam[] {
  const out: LocatedTeam[] = [];
  for (const t of teams) {
    const state = parseState(t.location);
    const c = (resolve ? resolve(t.city, state) : null) ?? lookupCoords(t.city);
    if (c) out.push({ name: t.name, city: t.city, lng: c.lng, lat: c.lat });
  }
  return out;
}

/** Teams whose coordinate falls inside a region polygon (point-in-polygon). */
export function teamsInFeature(
  teams: LocatedTeam[],
  f: Feature<Geometry, { name?: string }>,
): LocatedTeam[] {
  return teams.filter((t) => geoContains(f, [t.lng, t.lat]));
}

// --- Level rendering --------------------------------------------------------

export interface RegionPath {
  id: string;
  name: string;
  d: string;
  /** Teams located within this region — drives count shading + labels. */
  count: number;
}

export interface ScreenMarker {
  name: string;
  city: string;
  x: number;
  y: number;
}

export interface LevelView {
  paths: RegionPath[];
  markers: ScreenMarker[];
}

/**
 * Project a drill level into screen space: outline paths (with per-region team
 * counts) + team markers, all under one projection fit to `fitTo`. Use the
 * AlbersUSA composite for the national view; a plain Mercator fit for a single
 * state/county (Albers' composite layout would mis-zoom a sub-region).
 */
export function buildLevel(
  regions: RegionFeature[],
  fitTo: FeatureCollection | Feature,
  teams: LocatedTeam[],
  width: number,
  height: number,
  useAlbersUsa: boolean,
): LevelView {
  const projection: GeoProjection = (
    useAlbersUsa ? geoAlbersUsa() : geoMercator()
  ).fitSize([width, height], fitTo as Parameters<GeoProjection["fitSize"]>[1]);
  const path = geoPath(projection);

  const paths: RegionPath[] = [];
  for (const r of regions) {
    const d = path(r.feature);
    if (!d) continue;
    paths.push({
      id: r.id,
      name: r.name,
      d,
      count: teamsInFeature(teams, r.feature).length,
    });
  }

  const markers: ScreenMarker[] = [];
  for (const t of teams) {
    const p = projection([t.lng, t.lat]);
    if (!p) continue;
    markers.push({ name: t.name, city: t.city, x: round(p[0]), y: round(p[1]) });
  }

  return { paths, markers };
}
