import { describe, it, expect } from "vitest";
import {
  US_STATES,
  stateName,
  stateCode,
  citiesForState,
  cityCoords,
  type CitiesByState,
} from "../us-cities";

const data: CitiesByState = {
  GA: [
    { n: "Marietta", lat: 33.95, lng: -84.54 },
    { n: "Kennesaw", lat: 34.03, lng: -84.62 },
  ],
  CA: [{ n: "Los Angeles", lat: 34.05, lng: -118.24 }],
};

describe("US_STATES", () => {
  it("covers the 50 states + DC", () => {
    expect(US_STATES).toHaveLength(51);
    expect(US_STATES.some((s) => s.code === "DC")).toBe(true);
  });
});

describe("stateName / stateCode", () => {
  it("round-trips code ↔ name", () => {
    expect(stateName("GA")).toBe("Georgia");
    expect(stateCode("Georgia")).toBe("GA");
    expect(stateName("ZZ")).toBeNull();
    expect(stateCode("Nowhere")).toBeNull();
  });
});

describe("citiesForState", () => {
  it("returns the state's cities, or [] when unknown", () => {
    expect(citiesForState(data, "GA").map((c) => c.n)).toEqual([
      "Marietta",
      "Kennesaw",
    ]);
    expect(citiesForState(data, "WY")).toEqual([]);
  });
});

describe("cityCoords", () => {
  it("resolves a (state, city) pair exactly and case-insensitively", () => {
    expect(cityCoords(data, "GA", "Marietta")).toEqual({
      lat: 33.95,
      lng: -84.54,
    });
    expect(cityCoords(data, "GA", "marietta")).toEqual({
      lat: 33.95,
      lng: -84.54,
    });
  });

  it("returns null for an unknown city or state", () => {
    expect(cityCoords(data, "GA", "Atlantis")).toBeNull();
    expect(cityCoords(data, "WY", "Marietta")).toBeNull();
  });
});
