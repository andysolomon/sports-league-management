import { describe, it, expect } from "vitest";
import {
  ATTRIBUTE_MAX,
  TRAINING_FOCUSES,
  TRAINING_POINT_OPTIONS,
  applyTraining,
  focusAttributeKeys,
  isTrainingFocus,
  totalAllocatedPoints,
  trainingBonus,
  trainingGate,
  type TrainingFocus,
} from "../training";
import {
  ATTRIBUTE_GROUPS,
  COMMON_KEYS,
  GROUP_KEYS,
} from "../../../../convex/lib/positions";

const WR_ATTRIBUTES = {
  SPD: 80,
  STR: 62,
  AGI: 78,
  ACC: 79,
  AWR: 70,
  STA: 74,
  CTH: 82,
  SRR: 76,
  MRR: 71,
  DRR: 69,
  CIT: 73,
  RLS: 75,
};

describe("trainingBonus", () => {
  it("earns more from more points", () => {
    const small = trainingBonus({
      focus: "athleticism",
      points: 2,
      positionGroup: "WR",
    });
    const large = trainingBonus({
      focus: "athleticism",
      points: 10,
      positionGroup: "WR",
    });
    expect(large).toBeGreaterThan(small);
  });

  it("rewards spreading a budget over dumping it", () => {
    /*
     * The property the whole slice rests on. Ten points on one player must be
     * worth less than one point on each of ten, or the budget is a single
     * decision rather than a portfolio.
     */
    const dumped = trainingBonus({
      focus: "athleticism",
      points: 10,
      positionGroup: "WR",
    });
    const spread =
      10 *
      trainingBonus({ focus: "athleticism", points: 1, positionGroup: "WR" });
    expect(spread).toBeGreaterThan(dumped);
  });

  it("is strictly monotonic in every point count a coach can pick", () => {
    const yields = TRAINING_POINT_OPTIONS.map((points) =>
      trainingBonus({ focus: "athleticism", points, positionGroup: "WR" }),
    );
    for (let i = 1; i < yields.length; i++) {
      expect(yields[i]!).toBeGreaterThan(yields[i - 1]!);
    }
  });

  it("rises with the coach's development rating", () => {
    const base = { focus: "athleticism", points: 5, positionGroup: "WR" };
    const poor = trainingBonus({ ...base, developmentRating: 10 });
    const neutral = trainingBonus({ ...base, developmentRating: 50 });
    const elite = trainingBonus({ ...base, developmentRating: 90 });
    expect(poor).toBeLessThan(neutral);
    expect(neutral).toBeLessThan(elite);
  });

  it("rises with facilities", () => {
    const base = { focus: "athleticism", points: 5, positionGroup: "WR" };
    expect(trainingBonus({ ...base, facilities: 90 })).toBeGreaterThan(
      trainingBonus({ ...base, facilities: 10 }),
    );
  });

  it("treats a missing rating as neutral rather than as zero", () => {
    /*
     * No league has a coach rating or facilities yet — C1 and C2 have not
     * shipped. Reading their absence as a bad coach would make every league's
     * training worse for a reason nobody could see.
     */
    const absent = trainingBonus({
      focus: "athleticism",
      points: 5,
      positionGroup: "WR",
    });
    const neutral = trainingBonus({
      focus: "athleticism",
      points: 5,
      positionGroup: "WR",
      developmentRating: 50,
      facilities: 50,
    });
    expect(absent).toBeCloseTo(neutral, 10);
  });

  it("earns the same total whatever the focus — focus changes shape, not size", () => {
    const totals = TRAINING_FOCUSES.map((focus) =>
      trainingBonus({ focus: focus.id, points: 5, positionGroup: "WR" }),
    );
    for (const total of totals) expect(total).toBeCloseTo(totals[0]!, 10);
  });

  it("earns nothing from a focus that is not one", () => {
    expect(
      trainingBonus({ focus: "vibes", points: 10, positionGroup: "WR" }),
    ).toBe(0);
  });

  it("earns nothing from zero or negative points", () => {
    for (const points of [0, -5, Number.NaN]) {
      expect(
        trainingBonus({ focus: "athleticism", points, positionGroup: "WR" }),
      ).toBe(0);
    }
  });
});

describe("focusAttributeKeys", () => {
  it("gives every attribute group a technique focus it can train", () => {
    // A group with no technique keys would silently offer a focus that bought
    // nothing, which is worse than not offering it.
    for (const group of ATTRIBUTE_GROUPS) {
      expect(focusAttributeKeys("technique", group).length).toBeGreaterThan(0);
    }
  });

  it("routes technique through the group's own ratings", () => {
    expect(focusAttributeKeys("technique", "QB")).toEqual(GROUP_KEYS.QB);
    expect(focusAttributeKeys("technique", "OL")).toEqual(GROUP_KEYS.OL);
  });

  it("keeps the athletic focuses on ratings every player carries", () => {
    for (const focus of ["athleticism", "strength", "football_iq"] as const) {
      for (const key of focusAttributeKeys(focus, "QB")) {
        expect(COMMON_KEYS).toContain(key);
      }
    }
  });

  it("has nothing to train for an unknown group's technique", () => {
    expect(focusAttributeKeys("technique", "GOALIE")).toEqual([]);
  });
});

describe("applyTraining", () => {
  it("moves only the attributes the focus develops", () => {
    const result = applyTraining({
      attributes: WR_ATTRIBUTES,
      positionGroup: "WR",
      allocations: [{ focus: "athleticism", points: 5 }],
    });
    const moved = Object.keys(result.gains).sort();
    expect(moved.every((key) => ["SPD", "ACC", "AGI"].includes(key))).toBe(true);
    expect(result.attributes.CTH).toBe(WR_ATTRIBUTES.CTH);
  });

  it("places every point it earns", () => {
    // Sharing out and rounding down four ways is how a coach loses a point
    // they paid for.
    const result = applyTraining({
      attributes: WR_ATTRIBUTES,
      positionGroup: "WR",
      allocations: [{ focus: "technique", points: 10 }],
    });
    const earned = Math.round(
      trainingBonus({ focus: "technique", points: 10, positionGroup: "WR" }),
    );
    expect(result.pointsPlaced).toBe(earned);
    const summed = Object.values(result.gains).reduce((a, b) => a + b, 0);
    expect(summed).toBe(earned);
  });

  it("lifts the floor within a focus before the peak", () => {
    const result = applyTraining({
      attributes: { SPD: 90, ACC: 60, AGI: 89, AWR: 70 },
      positionGroup: "WR",
      allocations: [{ focus: "athleticism", points: 2 }],
    });
    expect(result.gains.ACC).toBeGreaterThan(0);
    expect(result.gains.SPD ?? 0).toBe(0);
  });

  it("never pushes a rating past the ceiling", () => {
    const result = applyTraining({
      attributes: { SPD: 99, ACC: 99, AGI: 99, AWR: 70 },
      positionGroup: "WR",
      allocations: [{ focus: "athleticism", points: 10 }],
    });
    expect(result.attributes.SPD).toBe(ATTRIBUTE_MAX);
    expect(result.pointsPlaced).toBe(0);
  });

  it("says so when a maxed-out focus has nowhere to put the points", () => {
    // Honest absence. Reporting a gain that did not land would make the panel
    // and the roster disagree about the same player.
    const result = applyTraining({
      attributes: { SPD: 99, ACC: 99, AGI: 99 },
      positionGroup: "WR",
      allocations: [{ focus: "athleticism", points: 10 }],
    });
    expect(result.gains).toEqual({});
  });

  it("never invents a rating the player was not given", () => {
    /*
     * A punter has no coverage ratings. Training a key that is not in his map
     * would put one on him rather than developing what he has.
     */
    const result = applyTraining({
      attributes: { KPW: 70, KAC: 68 },
      positionGroup: "P",
      allocations: [{ focus: "athleticism", points: 5 }],
    });
    expect(result.attributes).toEqual({ KPW: 70, KAC: 68 });
    expect(result.pointsPlaced).toBe(0);
  });

  it("accumulates several allocations on the same player", () => {
    const result = applyTraining({
      attributes: WR_ATTRIBUTES,
      positionGroup: "WR",
      allocations: [
        { focus: "athleticism", points: 5 },
        { focus: "technique", points: 5 },
      ],
    });
    const one = Math.round(
      trainingBonus({ focus: "athleticism", points: 5, positionGroup: "WR" }),
    );
    expect(result.pointsPlaced).toBe(one * 2);
  });

  it("is deterministic — training a coach paid for never rolls badly", () => {
    const run = () =>
      applyTraining({
        attributes: WR_ATTRIBUTES,
        positionGroup: "WR",
        allocations: [{ focus: "technique", points: 10 }],
      });
    expect(run()).toEqual(run());
  });

  it("scales with an explicit multiplier and treats its absence as neutral", () => {
    const base = {
      attributes: WR_ATTRIBUTES,
      positionGroup: "WR",
      allocations: [{ focus: "athleticism", points: 5 }],
    };
    expect(applyTraining({ ...base, multiplier: 1 })).toEqual(
      applyTraining(base),
    );
    expect(
      applyTraining({ ...base, multiplier: 2 }).pointsPlaced,
    ).toBeGreaterThan(applyTraining(base).pointsPlaced);
  });

  it("ignores an allocation whose focus is not one", () => {
    const result = applyTraining({
      attributes: WR_ATTRIBUTES,
      positionGroup: "WR",
      allocations: [{ focus: "vibes", points: 10 }],
    });
    expect(result.attributes).toEqual(WR_ATTRIBUTES);
    expect(result.pointsPlaced).toBe(0);
  });
});

describe("trainingGate", () => {
  it("allows an allocation inside the budget", () => {
    expect(
      trainingGate({ focus: "athleticism", points: 5, spent: 0, total: 100 }),
    ).toEqual({ ok: true });
  });

  it("refuses the allocation that would go over, not the one that fills it", () => {
    expect(
      trainingGate({ focus: "athleticism", points: 5, spent: 95, total: 100 }),
    ).toEqual({ ok: true });
    expect(
      trainingGate({ focus: "athleticism", points: 6, spent: 95, total: 100 }),
    ).toEqual({ ok: false, reason: "training_budget_exhausted" });
  });

  it("refuses a focus that is not one", () => {
    expect(
      trainingGate({ focus: "vibes", points: 5, spent: 0, total: 100 }),
    ).toEqual({ ok: false, reason: "invalid_focus" });
  });

  it("refuses fractional, zero and negative points", () => {
    for (const points of [0, -1, 2.5]) {
      expect(
        trainingGate({ focus: "athleticism", points, spent: 0, total: 100 }),
      ).toEqual({ ok: false, reason: "invalid_points" });
    }
  });

  it("refuses everything when the budget is zero", () => {
    // A league that turned training off must not be able to spend one point.
    expect(
      trainingGate({ focus: "athleticism", points: 1, spent: 0, total: 0 }),
    ).toEqual({ ok: false, reason: "training_budget_exhausted" });
  });
});

describe("the focus vocabulary", () => {
  it("offers only focuses the gate accepts", () => {
    for (const focus of TRAINING_FOCUSES) {
      expect(isTrainingFocus(focus.id)).toBe(true);
    }
  });

  it("gives every focus a distinct id", () => {
    const ids = new Set<TrainingFocus>(TRAINING_FOCUSES.map((f) => f.id));
    expect(ids.size).toBe(TRAINING_FOCUSES.length);
  });
});

describe("totalAllocatedPoints", () => {
  it("sums a ledger", () => {
    expect(totalAllocatedPoints([{ points: 2 }, { points: 5 }])).toBe(7);
  });

  it("ignores a row with a nonsense point count rather than returning NaN", () => {
    expect(
      totalAllocatedPoints([{ points: 5 }, { points: Number.NaN }]),
    ).toBe(5);
  });
});
