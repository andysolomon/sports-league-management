import { describe, it, expect } from "vitest";
import {
  normalizeCity,
  lookupCoords,
  parseState,
  projectUS,
  geocodedPoints,
  teamRegions,
} from "../geo";

describe("city lookup", () => {
  it("normalizes and matches known cities case/space-insensitively", () => {
    expect(normalizeCity("  Austin ")).toBe("austin");
    expect(lookupCoords("Austin")).toEqual({ lat: 30.27, lng: -97.74 });
    expect(lookupCoords("AUSTIN")).not.toBeNull();
  });
  it("returns null for unknown cities", () => {
    expect(lookupCoords("Smallville")).toBeNull();
  });
});

describe("parseState", () => {
  it("extracts a two-letter state from 'City, ST'", () => {
    expect(parseState("Austin, TX")).toBe("TX");
    expect(parseState("Dallas, tx")).toBe("TX");
  });
  it("returns null when absent", () => {
    expect(parseState("Austin")).toBeNull();
    expect(parseState(null)).toBeNull();
  });
});

describe("projectUS", () => {
  it("maps the bbox corners to the box corners (y inverted)", () => {
    // bottom-left of the US bbox → bottom-left of the box
    expect(projectUS(24, -125, 100, 100)).toEqual({ x: 0, y: 100 });
    // top-right → top-right
    expect(projectUS(50, -66, 100, 100)).toEqual({ x: 100, y: 0 });
  });
  it("clamps out-of-range coordinates", () => {
    expect(projectUS(90, 0, 100, 100)).toEqual({ x: 100, y: 0 });
  });
});

describe("geocodedPoints", () => {
  it("projects only teams with a known city", () => {
    const pts = geocodedPoints(
      [
        { name: "Hawks", city: "Austin" },
        { name: "Bears", city: "Smallville" }, // unknown → dropped
        { name: "Owls", city: "Dallas" },
      ],
      100,
      100,
    );
    expect(pts.map((p) => p.name)).toEqual(["Hawks", "Owls"]);
    expect(pts[0]).toMatchObject({ city: "Austin" });
  });
});

describe("teamRegions", () => {
  it("groups by state when present, else city, sorted by count", () => {
    const regions = teamRegions([
      { name: "A", city: "Austin", location: "Austin, TX" },
      { name: "B", city: "Dallas", location: "Dallas, TX" },
      { name: "C", city: "Miami", location: "Miami, FL" },
      { name: "D", city: "Reno" }, // no state → city bucket
    ]);
    expect(regions[0]).toEqual({ region: "TX", count: 2 });
    expect(regions.find((r) => r.region === "FL")?.count).toBe(1);
    expect(regions.find((r) => r.region === "Reno")?.count).toBe(1);
  });
});
