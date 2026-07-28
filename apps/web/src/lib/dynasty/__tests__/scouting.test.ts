import { describe, it, expect } from "vitest";
import {
  MAX_SCOUT_LEVEL,
  OVERALL_MAX,
  OVERALL_MIN,
  SCOUT_BAND_WIDTH,
  applyScoutingNoise,
  clampScoutLevel,
  nextScoutCost,
  scoutingBand,
  scoutingBands,
} from "@/lib/dynasty/scouting";

/*
 * The invariants a recruiting board stands on (B3).
 *
 * These are property tests over a wide sweep of prospects and ratings rather
 * than a handful of fixtures, because the failures they guard against live at
 * the edges — a prospect at 99, a prospect at 40, a band that clamps against a
 * rail — and a fixed example would sail straight past them.
 */

const IDS = Array.from({ length: 60 }, (_, i) => `prospect_${i}`);
const OVERALLS = [40, 41, 47, 55, 63, 70, 78, 86, 94, 98, 99];

describe("scoutingBands", () => {
  it("nests every level inside the one below it", () => {
    /*
     * The invariant that makes scouting feel honest. If band 3 could sit
     * outside band 2, spending a point would move the range AWAY from where it
     * was, and a coach would reasonably conclude the game was lying.
     *
     * "Strictly inside" is expressed as containment plus strict narrowing
     * rather than strict inequality on both edges: a band clamped against 40 or
     * 99 shares that edge with the wider band around it, and demanding a gap
     * there would make the rails unreachable.
     */
    for (const id of IDS) {
      for (const overall of OVERALLS) {
        const bands = scoutingBands(id, overall);
        for (let level = 1; level <= MAX_SCOUT_LEVEL; level++) {
          const tight = bands[level];
          const wide = bands[level - 1];
          expect(tight.projectedLow).toBeGreaterThanOrEqual(wide.projectedLow);
          expect(tight.projectedHigh).toBeLessThanOrEqual(wide.projectedHigh);
          expect(tight.projectedHigh - tight.projectedLow).toBeLessThan(
            wide.projectedHigh - wide.projectedLow,
          );
        }
      }
    }
  });

  it("never collapses to a single number, even at the top level", () => {
    // A zero-width band at level 3 would be an exact rating, and recruiting
    // would stop being a judgment call the moment anyone spent the points.
    for (const id of IDS) {
      for (const overall of OVERALLS) {
        const band = scoutingBands(id, overall)[MAX_SCOUT_LEVEL];
        expect(band.projectedHigh - band.projectedLow).toBe(
          SCOUT_BAND_WIDTH[MAX_SCOUT_LEVEL],
        );
        expect(band.projectedHigh - band.projectedLow).toBeGreaterThan(0);
      }
    }
  });

  it("always contains the true overall", () => {
    /*
     * The band is imprecise, never wrong. Bust risk lives in `potentialTier`,
     * which no scout level reveals — a range that could exclude the truth would
     * make an unlucky read indistinguishable from a bug.
     */
    for (const id of IDS) {
      for (const overall of OVERALLS) {
        for (const band of scoutingBands(id, overall)) {
          expect(overall).toBeGreaterThanOrEqual(band.projectedLow);
          expect(overall).toBeLessThanOrEqual(band.projectedHigh);
        }
      }
    }
  });

  it("stays on the ratings scale at both rails", () => {
    for (const id of IDS) {
      for (const overall of [OVERALL_MIN, OVERALL_MAX]) {
        for (const band of scoutingBands(id, overall)) {
          expect(band.projectedLow).toBeGreaterThanOrEqual(OVERALL_MIN);
          expect(band.projectedHigh).toBeLessThanOrEqual(OVERALL_MAX);
        }
      }
    }
  });

  it("gives different prospects different bands at the same rating", () => {
    // A shared stream would make the whole board move together, so scouting
    // one prospect would tell you about every other one at his rating.
    const bands = IDS.map((id) => scoutingBands(id, 70)[0].projectedLow);
    expect(new Set(bands).size).toBeGreaterThan(1);
  });
});

describe("applyScoutingNoise", () => {
  const trueAttributes = { SPD: 82, STR: 61, AWR: 74, ACC: 88, AGI: 55 };

  it("is deterministic per (prospectId, scoutLevel)", () => {
    // Re-reading a prospect must never reshuffle his range. A board that moved
    // on refresh would make the numbers unusable for comparison.
    for (let level = 0; level <= MAX_SCOUT_LEVEL; level++) {
      const first = applyScoutingNoise({
        prospectId: "prospect_7",
        scoutLevel: level,
        trueOverall: 72,
        trueAttributes,
      });
      const second = applyScoutingNoise({
        prospectId: "prospect_7",
        scoutLevel: level,
        trueOverall: 72,
        trueAttributes,
      });
      expect(second).toEqual(first);
    }
  });

  it("reports the band the same function would compute directly", () => {
    for (let level = 0; level <= MAX_SCOUT_LEVEL; level++) {
      const report = applyScoutingNoise({
        prospectId: "prospect_11",
        scoutLevel: level,
        trueOverall: 64,
        trueAttributes,
      });
      const band = scoutingBand("prospect_11", 64, level);
      expect(report.projectedLow).toBe(band.projectedLow);
      expect(report.projectedHigh).toBe(band.projectedHigh);
    }
  });

  it("blurs every attribute and keeps them on the scale", () => {
    const report = applyScoutingNoise({
      prospectId: "prospect_3",
      scoutLevel: 0,
      trueOverall: 70,
      trueAttributes,
    });
    expect(Object.keys(report.scoutedAttributes).sort()).toEqual(
      Object.keys(trueAttributes).sort(),
    );
    for (const value of Object.values(report.scoutedAttributes)) {
      expect(value).toBeGreaterThanOrEqual(OVERALL_MIN);
      expect(value).toBeLessThanOrEqual(OVERALL_MAX);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("blurs attributes less at higher levels, on average", () => {
    /*
     * Asserted as an aggregate over the whole board rather than per prospect:
     * a single prospect can draw a small offset at level 0 by luck, and a test
     * that demanded otherwise would be flaky by construction.
     */
    const meanError = (level: number) => {
      let total = 0;
      let count = 0;
      for (const id of IDS) {
        const report = applyScoutingNoise({
          prospectId: id,
          scoutLevel: level,
          trueOverall: 70,
          trueAttributes,
        });
        for (const [key, value] of Object.entries(report.scoutedAttributes)) {
          total += Math.abs(value - trueAttributes[key as keyof typeof trueAttributes]);
          count += 1;
        }
      }
      return total / count;
    };
    expect(meanError(3)).toBeLessThan(meanError(0));
  });

  it("clamps a level outside the scale rather than throwing", () => {
    // Storage is a plain number, so a row from a future version with level 9
    // has to render as something rather than take the board down.
    expect(clampScoutLevel(9)).toBe(MAX_SCOUT_LEVEL);
    expect(clampScoutLevel(-4)).toBe(0);
    expect(clampScoutLevel(Number.NaN)).toBe(0);
    expect(
      applyScoutingNoise({
        prospectId: "prospect_1",
        scoutLevel: 99,
        trueOverall: 70,
        trueAttributes,
      }).scoutLevel,
    ).toBe(MAX_SCOUT_LEVEL);
  });
});

describe("nextScoutCost", () => {
  it("rises with each level, so a budget cannot buy certainty everywhere", () => {
    const costs = [0, 1, 2].map((level) => nextScoutCost(level));
    expect(costs.every((c) => c !== null)).toBe(true);
    expect(costs[1]!).toBeGreaterThan(costs[0]!);
    expect(costs[2]!).toBeGreaterThan(costs[1]!);
  });

  it("returns null once a prospect is fully scouted", () => {
    expect(nextScoutCost(MAX_SCOUT_LEVEL)).toBeNull();
  });
});
