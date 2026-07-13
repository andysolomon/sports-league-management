import { describe, it, expect } from "vitest";
import { simulateScore, seedFromString } from "../simulate-game";

describe("simulateScore", () => {
  it("is deterministic for a given seed", () => {
    const a = simulateScore({ homeStrength: 70, awayStrength: 60, seed: 42 });
    const b = simulateScore({ homeStrength: 70, awayStrength: 60, seed: 42 });
    expect(a).toEqual(b);
  });

  it("returns non-negative integer scores", () => {
    for (let s = 0; s < 50; s++) {
      const { homeScore, awayScore } = simulateScore({
        homeStrength: 50,
        awayStrength: 50,
        seed: s,
      });
      for (const v of [homeScore, awayScore]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("lets the stronger team win the clear majority — but upsets still happen", () => {
    let strongWins = 0;
    const N = 400;
    for (let s = 0; s < N; s++) {
      // Home is clearly stronger (72 vs 52) — favored, not a lock.
      const { homeScore, awayScore } = simulateScore({
        homeStrength: 72,
        awayStrength: 52,
        seed: s * 7919 + 1,
      });
      if (homeScore > awayScore) strongWins++;
    }
    // Favored team wins a clear majority, but the underdog steals some.
    expect(strongWins / N).toBeGreaterThan(0.65);
    expect(strongWins).toBeLessThan(N);
  });

  it("evenly-matched teams are roughly a coin flip over many seeds", () => {
    let homeWins = 0;
    const N = 400;
    for (let s = 0; s < N; s++) {
      const { homeScore, awayScore } = simulateScore({
        homeStrength: 55,
        awayStrength: 55,
        seed: s * 104729 + 3,
      });
      if (homeScore > awayScore) homeWins++;
    }
    // Home-field nudges it slightly above 50% but it stays competitive.
    expect(homeWins / N).toBeGreaterThan(0.45);
    expect(homeWins / N).toBeLessThan(0.7);
  });

  it("never ties when decisive is set", () => {
    for (let s = 0; s < 200; s++) {
      const { homeScore, awayScore } = simulateScore({
        homeStrength: 50,
        awayStrength: 50,
        seed: s,
        decisive: true,
      });
      expect(homeScore).not.toBe(awayScore);
    }
  });

  it("re-exports seedFromString for per-fixture seeding", () => {
    expect(seedFromString("fixture_1")).toBe(seedFromString("fixture_1"));
    expect(seedFromString("fixture_1")).not.toBe(seedFromString("fixture_2"));
  });

  it("matches legacy output when flavor is omitted or balanced", () => {
    const input = { homeStrength: 70, awayStrength: 60, seed: 42 };
    const legacy = simulateScore(input);
    const explicit = simulateScore({ ...input, flavor: "balanced" });
    expect(explicit).toEqual(legacy);
  });
});
