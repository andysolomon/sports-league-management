import { describe, it, expect } from "vitest";
import {
  generateSyntheticRoster,
  seedFromString,
} from "../synthetic-roster";

describe("generateSyntheticRoster", () => {
  it("generates exactly `count` players", () => {
    expect(generateSyntheticRoster({ count: 48, seed: 1 })).toHaveLength(48);
    expect(generateSyntheticRoster({ count: 12, seed: 1 })).toHaveLength(12);
    expect(generateSyntheticRoster({ count: 0, seed: 1 })).toHaveLength(0);
  });

  it("is deterministic for a given seed", () => {
    const a = generateSyntheticRoster({ count: 24, seed: 42 });
    const b = generateSyntheticRoster({ count: 24, seed: 42 });
    expect(a).toEqual(b);
  });

  it("varies with the seed", () => {
    const a = generateSyntheticRoster({ count: 24, seed: 1 });
    const b = generateSyntheticRoster({ count: 24, seed: 2 });
    expect(a).not.toEqual(b);
  });

  it("assigns unique jersey numbers and avoids excluded ones", () => {
    const exclude = [1, 2, 3, 7, 12];
    const roster = generateSyntheticRoster({ count: 40, excludeJerseys: exclude, seed: 9 });
    const jerseys = roster.map((p) => p.jerseyNumber);
    expect(new Set(jerseys).size).toBe(jerseys.length); // all unique
    for (const e of exclude) expect(jerseys).not.toContain(e); // none excluded
    for (const j of jerseys) expect(j).toBeGreaterThanOrEqual(0);
    for (const j of jerseys) expect(j).toBeLessThanOrEqual(99);
  });

  it("produces unique names within a batch", () => {
    const roster = generateSyntheticRoster({ count: 48, seed: 5 });
    const names = roster.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("avoids names already used in the league when possible", () => {
    const roster = generateSyntheticRoster({
      count: 10,
      seed: 11,
      excludeNames: ["Aaron Adams", "Aaliyah Abbott"],
    });
    expect(roster.map((p) => p.name)).not.toContain("Aaron Adams");
    expect(roster.map((p) => p.name)).not.toContain("Aaliyah Abbott");
  });

  it("gives a believable position spread (not all one position)", () => {
    const roster = generateSyntheticRoster({ count: 48, seed: 3 });
    const positions = new Set(roster.map((p) => p.position));
    expect(positions.size).toBeGreaterThan(8); // many distinct positions
    expect(roster.some((p) => p.position === "QB")).toBe(true);
    expect(roster.some((p) => p.position === "K")).toBe(true);
  });

  it("uses HS grades 9–12 and canonical Active status", () => {
    const roster = generateSyntheticRoster({ count: 30, seed: 7 });
    for (const p of roster) {
      expect(p.grade).toBeGreaterThanOrEqual(9);
      expect(p.grade).toBeLessThanOrEqual(12);
      expect(p.status).toBe("Active");
      expect(["Varsity", "JV"]).toContain(p.squad);
      expect(p.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const year = Number(p.dateOfBirth.slice(0, 4));
      expect(year).toBeGreaterThanOrEqual(2006);
      expect(year).toBeLessThanOrEqual(2013);
      expect(p.hometown).toMatch(/, [A-Z]{2}$/);
    }
  });
});

describe("seedFromString", () => {
  it("is stable and varies by input", () => {
    expect(seedFromString("team_abc")).toBe(seedFromString("team_abc"));
    expect(seedFromString("team_abc")).not.toBe(seedFromString("team_xyz"));
  });
});
