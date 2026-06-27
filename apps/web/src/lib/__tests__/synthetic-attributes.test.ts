import { describe, it, expect } from "vitest";
import {
  generateSyntheticAttributes,
  attributeGroupForPosition,
  seedFromString,
} from "../synthetic-attributes";

describe("attributeGroupForPosition", () => {
  it("maps concrete positions to attribute groups", () => {
    expect(attributeGroupForPosition("QB")).toBe("QB");
    expect(attributeGroupForPosition("RB")).toBe("RB");
    expect(attributeGroupForPosition("LT")).toBe("OL");
    expect(attributeGroupForPosition("CB")).toBe("DB");
    expect(attributeGroupForPosition("MLB")).toBe("LB");
  });

  it("splits the roster K/P group into K and P", () => {
    expect(attributeGroupForPosition("K")).toBe("K");
    expect(attributeGroupForPosition("P")).toBe("P");
    expect(attributeGroupForPosition("LS")).toBe("K"); // long snapper → special teams
  });

  it("falls back to WR for unmappable positions", () => {
    expect(attributeGroupForPosition("ATH")).toBe("WR");
    expect(attributeGroupForPosition("???")).toBe("WR");
  });
});

describe("generateSyntheticAttributes", () => {
  it("is deterministic for a given position + seed", () => {
    const a = generateSyntheticAttributes({ position: "QB", seed: 42 });
    const b = generateSyntheticAttributes({ position: "QB", seed: 42 });
    expect(a).toEqual(b);
  });

  it("varies with the seed", () => {
    const a = generateSyntheticAttributes({ position: "QB", seed: 1 });
    const b = generateSyntheticAttributes({ position: "QB", seed: 2 });
    expect(a.attributes).not.toEqual(b.attributes);
  });

  it("produces position-appropriate keys", () => {
    const qb = generateSyntheticAttributes({ position: "QB", seed: 7 });
    expect(qb.positionGroup).toBe("QB");
    // Common athletic keys + QB-specific throwing keys.
    expect(qb.attributes).toHaveProperty("SPD");
    expect(qb.attributes).toHaveProperty("THP");
    expect(qb.attributes).toHaveProperty("DAC");

    const ol = generateSyntheticAttributes({ position: "C", seed: 7 });
    expect(ol.positionGroup).toBe("OL");
    expect(ol.attributes).toHaveProperty("PBK");
    expect(ol.attributes).not.toHaveProperty("THP");
  });

  it("keeps every attribute and the overall in the 40–99 band", () => {
    for (const pos of ["QB", "RB", "WR", "TE", "LT", "DE", "MLB", "CB", "K", "P"]) {
      const snap = generateSyntheticAttributes({ position: pos, seed: 13 });
      for (const value of Object.values(snap.attributes)) {
        expect(value).toBeGreaterThanOrEqual(40);
        expect(value).toBeLessThanOrEqual(99);
        expect(Number.isInteger(value)).toBe(true);
      }
      expect(snap.weightedOverall).toBeGreaterThanOrEqual(40);
      expect(snap.weightedOverall).toBeLessThanOrEqual(99);
      expect(Number.isInteger(snap.weightedOverall)).toBe(true);
    }
  });

  it("the overall is the rounded mean of the attribute map", () => {
    const snap = generateSyntheticAttributes({ position: "WR", seed: 99 });
    const values = Object.values(snap.attributes);
    const mean = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    expect(snap.weightedOverall).toBe(mean);
  });

  it("re-exports seedFromString for per-player seeding", () => {
    expect(typeof seedFromString("player_abc")).toBe("number");
    expect(seedFromString("player_abc")).toBe(seedFromString("player_abc"));
  });
});
