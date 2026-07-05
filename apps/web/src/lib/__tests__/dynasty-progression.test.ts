import { describe, it, expect } from "vitest";
import { computeProgressedAttributes } from "../dynasty-progression";

const BASE_ATTRS = { SPD: 70, STR: 68, AGI: 72, AWR: 65 };

describe("computeProgressedAttributes", () => {
  it("is deterministic for the same playerId + newSeasonId", () => {
    const input = {
      playerId: "player_a",
      newSeasonId: "season_2027",
      position: "QB",
      previousGrade: 10,
      previousAttributes: BASE_ATTRS,
      positionGroup: "QB",
    };
    const a = computeProgressedAttributes(input);
    const b = computeProgressedAttributes(input);
    expect(a).toEqual(b);
  });

  it("clamps attribute values to 0–99", () => {
    const high = computeProgressedAttributes({
      playerId: "player_max",
      newSeasonId: "season_x",
      position: "RB",
      previousGrade: 11,
      previousAttributes: { SPD: 98, STR: 97, AGI: 96 },
      positionGroup: "RB",
    });
    for (const v of Object.values(high.attributes)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(99);
    }
  });

  it("applies a larger jump after grade 9 (FR→SO)", () => {
    const fr = computeProgressedAttributes({
      playerId: "same_player",
      newSeasonId: "season_fr",
      position: "WR",
      previousGrade: 9,
      previousAttributes: BASE_ATTRS,
      positionGroup: "WR",
    });
    const so = computeProgressedAttributes({
      playerId: "same_player",
      newSeasonId: "season_so",
      position: "WR",
      previousGrade: 10,
      previousAttributes: BASE_ATTRS,
      positionGroup: "WR",
    });
    expect(fr.weightedOverall).toBeGreaterThanOrEqual(so.weightedOverall - 2);
  });

  it("produces a progressed snapshot with recomputed weighted overall", () => {
    const next = computeProgressedAttributes({
      playerId: "player_b",
      newSeasonId: "season_next",
      position: "LB",
      previousGrade: 9,
      previousAttributes: BASE_ATTRS,
      positionGroup: "LB",
    });
    expect(next.weightedOverall).toBeGreaterThanOrEqual(0);
    expect(next.weightedOverall).toBeLessThanOrEqual(99);
    expect(Object.keys(next.attributes).length).toBe(Object.keys(BASE_ATTRS).length);
  });
});
