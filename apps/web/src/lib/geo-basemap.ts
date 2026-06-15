import { geoAlbersUsa, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
} from "geojson";

import { lookupCoords, type MapPoint, type TeamLoc } from "./geo";
import usTopo from "./geo/us-states-10m.json";

/**
 * Real US basemap helpers for the league map (WSM-000136 P5-b). Builds an
 * AlbersUSA projection fit to the SVG box, renders state outlines as SVG path
 * strings, and projects each geocodable team to screen pixels with the SAME
 * projection so markers land on the map. Pure and server-renderable: d3-geo
 * does no DOM work. Complements the equirectangular helpers in geo.ts (kept for
 * the existing tests); this file owns the basemap rendering.
 */

// us-atlas topojson is a Topology whose `states` object is a GeometryCollection.
// The JSON import isn't strongly typed, so narrow to the topojson Topology shape
// and let topojson-client produce a GeoJSON FeatureCollection.
type Topology = Parameters<typeof feature>[0];
type StateObject = Parameters<typeof feature>[1];

const topology = usTopo as unknown as Topology;

const STATES = feature(
  topology,
  topology.objects.states as StateObject,
) as unknown as FeatureCollection<Geometry, GeoJsonProperties>;

export interface Basemap {
  /** SVG `d` strings for each US state outline, fit to the box. */
  statePaths: string[];
  /** Projected team markers (only teams with a known city). */
  markers: MapPoint[];
}

/**
 * Build the basemap for a width×height SVG: state outline path strings plus
 * projected team markers, all using one AlbersUSA projection fit to the box.
 */
export function buildBasemap(
  teams: TeamLoc[],
  width: number,
  height: number,
): Basemap {
  const projection: GeoProjection = geoAlbersUsa().fitSize(
    [width, height],
    STATES,
  );
  const path = geoPath(projection);

  const statePaths: string[] = [];
  for (const f of STATES.features) {
    const d = path(f);
    if (d) statePaths.push(d);
  }

  const markers: MapPoint[] = [];
  for (const t of teams) {
    const coords = lookupCoords(t.city);
    if (!coords) continue;
    const projected = projection([coords.lng, coords.lat]);
    if (!projected) continue; // outside AlbersUSA clip (shouldn't happen for US cities)
    const [x, y] = projected;
    markers.push({
      name: t.name,
      city: t.city,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    });
  }

  return { statePaths, markers };
}
