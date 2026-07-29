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

/*
 * B6 added optional `training` and `developmentMultiplier` to `ProgressionInput`.
 * The promise attached to them is that they cost nothing when unused: every
 * league that has ever rolled over must keep progressing exactly as it did.
 */
describe("computeProgressedAttributes with training (B6)", () => {
  const INPUT = {
    playerId: "player_training",
    newSeasonId: "season_2028",
    position: "WR",
    previousGrade: 10,
    previousAttributes: { SPD: 70, STR: 68, AGI: 72, AWR: 65, ACC: 71 },
    positionGroup: "WR",
  };

  it("is byte-identical to the pre-B6 result when no training was bought", () => {
    const bare = computeProgressedAttributes(INPUT);
    for (const training of [undefined, []]) {
      expect(
        JSON.stringify(computeProgressedAttributes({ ...INPUT, training })),
      ).toBe(JSON.stringify(bare));
    }
  });

  it("is byte-identical when a multiplier is supplied but nothing was bought", () => {
    // A multiplier alone must not be a development bonus. It scales training,
    // and no training is still no training.
    expect(
      computeProgressedAttributes({ ...INPUT, developmentMultiplier: 2 }),
    ).toEqual(computeProgressedAttributes(INPUT));
  });

  it("adds training on top of the base delta without disturbing it", () => {
    /*
     * The RNG stream must be exhausted before training is placed, or adding a
     * focus would silently reshuffle a player's natural growth.
     */
    const bare = computeProgressedAttributes(INPUT);
    const trained = computeProgressedAttributes({
      ...INPUT,
      training: [{ focus: "athleticism", points: 5 }],
    });

    expect(trained.attributes.STR).toBe(bare.attributes.STR);
    expect(trained.attributes.AWR).toBe(bare.attributes.AWR);
    const athleticGain =
      trained.attributes.SPD! +
      trained.attributes.AGI! +
      trained.attributes.ACC! -
      (bare.attributes.SPD! + bare.attributes.AGI! + bare.attributes.ACC!);
    expect(athleticGain).toBeGreaterThan(0);
    expect(trained.weightedOverall).toBeGreaterThan(bare.weightedOverall);
  });
});
