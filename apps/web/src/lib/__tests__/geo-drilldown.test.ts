import { describe, it, expect } from "vitest";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import {
  statesAsRegions,
  findState,
  countiesForState,
  locateTeams,
  teamsInFeature,
  buildLevel,
  STATES,
} from "../geo-drilldown";

describe("statesAsRegions / findState", () => {
  it("exposes all US states with FIPS ids + names", () => {
    const regions = statesAsRegions();
    expect(regions.length).toBeGreaterThanOrEqual(50);
    const ga = regions.find((r) => r.id === "13");
    expect(ga?.name).toBe("Georgia");
  });

  it("findState resolves a state by FIPS id", () => {
    expect(findState("13")?.name).toBe("Georgia");
    expect(findState("99")).toBeNull();
  });
});

describe("countiesForState (FIPS prefix filter)", () => {
  // Synthetic county FeatureCollection — exercises the prefix filter + sort
  // without loading the ~800 KB asset (fetched only in the browser).
  const counties = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", id: "13135", properties: { name: "Gwinnett" }, geometry: null },
      { type: "Feature", id: "13067", properties: { name: "Cobb" }, geometry: null },
      { type: "Feature", id: "01001", properties: { name: "Autauga" }, geometry: null },
    ],
  } as unknown as FeatureCollection<Geometry, { name?: string }>;

  it("keeps only the requested state's counties, sorted by name", () => {
    const ga = countiesForState(counties, "13");
    expect(ga.map((c) => c.name)).toEqual(["Cobb", "Gwinnett"]);
    expect(ga.every((c) => c.id.startsWith("13"))).toBe(true);
  });

  it("returns none for a state with no counties in the set", () => {
    expect(countiesForState(counties, "06")).toEqual([]);
  });
});

describe("locateTeams", () => {
  it("keeps only teams whose city resolves to a coordinate", () => {
    const located = locateTeams([
      { name: "A", city: "Marietta" },
      { name: "B", city: "Nowheresville" },
    ]);
    expect(located.map((t) => t.name)).toEqual(["A"]);
    expect(located[0]).toMatchObject({ city: "Marietta" });
  });
});

describe("teamsInFeature (geoContains placement)", () => {
  const georgia = findState("13")!.feature as Feature<Geometry, { name?: string }>;

  it("includes a team inside the state and excludes one outside", () => {
    const located = locateTeams([
      { name: "Marietta HS", city: "Marietta" }, // inside GA
      { name: "LA HS", city: "Los Angeles" }, // outside GA
    ]);
    const inGa = teamsInFeature(located, georgia);
    expect(inGa.map((t) => t.name)).toEqual(["Marietta HS"]);
  });
});

describe("buildLevel", () => {
  const located = locateTeams([
    { name: "West", city: "Los Angeles" },
    { name: "East", city: "Marietta" },
  ]);

  it("produces a path per region with team counts, and a marker per team", () => {
    const view = buildLevel(statesAsRegions(), STATES, located, 320, 220, true);
    // AlbersUSA renders the 50 states + DC but not the offshore territories
    // (PR/VI/GU/AS/MP fall outside its clip → no path), so this is < features.
    expect(view.paths.length).toBeGreaterThanOrEqual(50);
    expect(view.paths.length).toBeLessThanOrEqual(STATES.features.length);
    expect(view.markers.length).toBe(2);
    // Georgia should count exactly the Marietta team.
    const ga = view.paths.find((p) => p.id === "13");
    expect(ga?.count).toBe(1);
  });

  it("projects western cities left of eastern cities (US view)", () => {
    const view = buildLevel(statesAsRegions(), STATES, located, 320, 220, true);
    const west = view.markers.find((m) => m.name === "West")!;
    const east = view.markers.find((m) => m.name === "East")!;
    expect(west.x).toBeLessThan(east.x);
  });
});
