import { describe, it, expect } from "vitest";
import {
  generateProspectClass,
  prospectClassSize,
} from "@/lib/dynasty/prospects";
import { OVERALL_MAX, OVERALL_MIN } from "@/lib/dynasty/scouting";

describe("generateProspectClass", () => {
  it("is deterministic per season, so a retried rollover rebuilds one class", () => {
    /*
     * The rollover stage can be retried after a lost response. If generation
     * drifted, the persistence guard would see an existing class and keep the
     * first one — but only by luck of ordering. Determinism is what makes the
     * retry genuinely a no-op rather than a race that usually goes the right
     * way.
     */
    const first = generateProspectClass({ seasonId: "season_x", count: 24 });
    const second = generateProspectClass({ seasonId: "season_x", count: 24 });
    expect(second).toEqual(first);
  });

  it("gives different seasons different classes", () => {
    const a = generateProspectClass({ seasonId: "season_a", count: 12 });
    const b = generateProspectClass({ seasonId: "season_b", count: 12 });
    expect(b.map((p) => p.name)).not.toEqual(a.map((p) => p.name));
  });

  it("never reuses a name already in the league", () => {
    // A prospect who shares a name with a rostered player makes every roster
    // view ambiguous the moment he signs.
    const existing = generateProspectClass({
      seasonId: "season_names",
      count: 20,
    }).map((p) => p.name);
    const next = generateProspectClass({
      seasonId: "season_names_2",
      count: 20,
      excludeNames: existing,
    });
    for (const prospect of next) {
      expect(existing).not.toContain(prospect.name);
    }
  });

  it("keeps every rating on the scale", () => {
    const board = generateProspectClass({ seasonId: "season_y", count: 60 });
    for (const prospect of board) {
      expect(prospect.trueOverall).toBeGreaterThanOrEqual(OVERALL_MIN);
      expect(prospect.trueOverall).toBeLessThanOrEqual(OVERALL_MAX);
      for (const value of Object.values(prospect.trueAttributes)) {
        expect(value).toBeGreaterThanOrEqual(OVERALL_MIN);
        expect(value).toBeLessThanOrEqual(OVERALL_MAX);
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it("produces a class with a real top and a real bottom", () => {
    /*
     * A board where everyone lands mid-pack gives scouting nothing to find.
     * The spread is the reason a coach would spend points at all, so it is
     * asserted rather than left to the generator's mood.
     */
    const board = generateProspectClass({ seasonId: "season_z", count: 72 });
    const overalls = board.map((p) => p.trueOverall);
    const spread = Math.max(...overalls) - Math.min(...overalls);
    expect(spread).toBeGreaterThan(20);
  });

  it("draws potential independently of current rating", () => {
    /*
     * The risk model. If potential tracked current rating, scouting to level 3
     * would tell you who develops, and there would be no such thing as a bust.
     * Asserted as "the best names are not all stars and the worst are not all
     * busts" rather than as a correlation coefficient, which is the claim that
     * actually matters at the table.
     */
    const board = generateProspectClass({ seasonId: "season_tiers", count: 96 });
    const sorted = [...board].sort((a, b) => b.trueOverall - a.trueOverall);
    const topTiers = new Set(sorted.slice(0, 24).map((p) => p.potentialTier));
    const bottomTiers = new Set(sorted.slice(-24).map((p) => p.potentialTier));
    expect(topTiers.size).toBeGreaterThan(1);
    expect(bottomTiers.size).toBeGreaterThan(1);
    expect(topTiers).toContain("bust");
  });

  it("gives every prospect an archetype and a ninth-grade shape", () => {
    const board = generateProspectClass({ seasonId: "season_w", count: 30 });
    for (const prospect of board) {
      expect(prospect.archetype.length).toBeGreaterThan(0);
      expect(prospect.position.length).toBeGreaterThan(0);
      expect(prospect.positionGroup.length).toBeGreaterThan(0);
    }
    // More than one position, or a class is a wall of quarterbacks.
    expect(new Set(board.map((p) => p.position)).size).toBeGreaterThan(3);
  });

  it("returns nothing for an empty class rather than throwing", () => {
    expect(generateProspectClass({ seasonId: "s", count: 0 })).toEqual([]);
    expect(generateProspectClass({ seasonId: "s", count: -5 })).toEqual([]);
  });

  it("generates past the roster generator's per-call cap", () => {
    // The name generator caps at 99 per call because it also hands out unique
    // jerseys. A 16-team league's class is larger than that.
    const board = generateProspectClass({ seasonId: "season_big", count: 150 });
    expect(board).toHaveLength(150);
    expect(new Set(board.map((p) => p.name)).size).toBe(150);
  });
});

describe("prospectClassSize", () => {
  it("scales with the league so recruiting stays contested", () => {
    expect(prospectClassSize(12)).toBe(72);
    expect(prospectClassSize(4)).toBe(24);
  });

  it("is zero for a league with no teams", () => {
    expect(prospectClassSize(0)).toBe(0);
  });
});
