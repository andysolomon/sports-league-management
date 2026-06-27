import { describe, it, expect } from "vitest";
import {
  seedOrder,
  buildBracket,
  buildDoubleElimBracket,
  nextPowerOfTwo,
} from "../lib/bracket";

describe("seedOrder (WSM-000164)", () => {
  it("rejects non-powers-of-two", () => {
    expect(() => seedOrder(6)).toThrow("bracket_size_must_be_power_of_two");
    expect(() => seedOrder(1)).toThrow();
  });

  it("produces the standard order for 4 and 8", () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it.each([4, 8, 16])("uses every seed once and pairs to N+1 (size %i)", (n) => {
    const order = seedOrder(n);
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: n }, (_, i) => i + 1),
    );
    for (let i = 0; i < n; i += 2) {
      expect(order[i] + order[i + 1]).toBe(n + 1); // round-1 opponents
    }
  });
});

describe("nextPowerOfTwo (WSM-flex-brackets)", () => {
  it.each([
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [6, 8],
    [8, 8],
    [10, 16],
    [12, 16],
    [16, 16],
    [17, 32],
  ])("nextPowerOfTwo(%i) === %i", (n, expected) => {
    expect(nextPowerOfTwo(n)).toBe(expected);
  });

  it("rejects counts below 2", () => {
    expect(() => nextPowerOfTwo(1)).toThrow("team_count_too_small");
  });
});

describe("buildBracket — power-of-two counts (WSM-000164)", () => {
  it.each([
    [4, 2, 3],
    [8, 3, 7],
    [16, 4, 15],
  ])("count %i → %i rounds and N-1 total matchups", (count, rounds, total) => {
    const b = buildBracket(count);
    expect(b.size).toBe(count);
    expect(b.rounds).toBe(rounds);
    expect(b.matchups).toHaveLength(total);
    for (let r = 1; r <= rounds; r++) {
      expect(b.matchups.filter((m) => m.round === r)).toHaveLength(
        count / 2 ** r,
      );
    }
  });

  it("has no byes when count is a power of two", () => {
    for (const count of [4, 8, 16]) {
      const b = buildBracket(count);
      expect(b.matchups.some((m) => m.isBye)).toBe(false);
    }
  });

  it("seeds only round 1; higher seed hosts; later rounds are TBD", () => {
    const b = buildBracket(8);
    const r1 = b.matchups.filter((m) => m.round === 1);
    for (const m of r1) {
      expect(m.homeSeed).not.toBeNull();
      expect(m.awaySeed).not.toBeNull();
      expect(m.homeSeed!).toBeLessThan(m.awaySeed!); // higher seed hosts
    }
    for (const m of b.matchups.filter((m) => m.round > 1)) {
      expect(m.homeSeed).toBeNull();
      expect(m.awaySeed).toBeNull();
    }
  });

  it("keeps seeds 1 and 2 in opposite halves (meet only in the final)", () => {
    const b = buildBracket(8);
    const r1 = b.matchups
      .filter((m) => m.round === 1)
      .sort((a, z) => a.slot - z.slot);
    const half = r1.length / 2;
    const seed1Slot = r1.findIndex((m) => m.homeSeed === 1 || m.awaySeed === 1);
    const seed2Slot = r1.findIndex((m) => m.homeSeed === 2 || m.awaySeed === 2);
    expect(seed1Slot < half).toBe(true);
    expect(seed2Slot >= half).toBe(true);
  });

  it("wires each non-final matchup to the correct parent slot/side", () => {
    const b = buildBracket(8);
    const final = b.matchups.find((m) => m.round === b.rounds)!;
    expect(final.parentSlot).toBeNull();
    expect(final.parentSide).toBeNull();
    for (const m of b.matchups.filter((m) => m.round < b.rounds)) {
      expect(m.parentSlot).toBe(Math.floor(m.slot / 2));
      expect(m.parentSide).toBe(m.slot % 2 === 0 ? "home" : "away");
    }
    const feeders = b.matchups.filter(
      (m) => m.round === 1 && m.parentSlot === 0,
    );
    expect(feeders.map((m) => m.parentSide).sort()).toEqual(["away", "home"]);
  });
});

describe("buildBracket — byes for non-power-of-two counts (WSM-flex-brackets)", () => {
  it("rejects counts below 2", () => {
    expect(() => buildBracket(1)).toThrow("team_count_too_small");
  });

  it.each([
    [5, 8, 8 - 5],
    [6, 8, 8 - 6],
    [10, 16, 16 - 10],
    [12, 16, 16 - 12],
  ])(
    "count %i → size %i with %i byes",
    (count, size, expectedByes) => {
      const b = buildBracket(count);
      expect(b.size).toBe(size);
      expect(b.rounds).toBe(Math.log2(size));
      const byes = b.matchups.filter((m) => m.round === 1 && m.isBye);
      expect(byes).toHaveLength(expectedByes);
    },
  );

  it("byes go to the TOP seeds and carry the present team as homeSeed", () => {
    const b = buildBracket(6); // size 8, 2 byes → seeds 1 and 2
    const byes = b.matchups.filter((m) => m.isBye);
    const byeSeeds = byes.map((m) => m.homeSeed).sort((a, z) => a! - z!);
    expect(byeSeeds).toEqual([1, 2]);
    for (const m of byes) {
      expect(m.awaySeed).toBeNull(); // no opponent — auto-advance
      expect(m.homeSeed).not.toBeNull();
    }
  });

  it("every real seed 1..count appears exactly once in round 1", () => {
    for (const count of [5, 6, 10, 12]) {
      const b = buildBracket(count);
      const seeds: number[] = [];
      for (const m of b.matchups.filter((m) => m.round === 1)) {
        if (m.homeSeed != null) seeds.push(m.homeSeed);
        if (m.awaySeed != null) seeds.push(m.awaySeed);
      }
      // No phantom seed > count survives.
      expect(Math.max(...seeds)).toBeLessThanOrEqual(count);
      expect([...seeds].sort((a, z) => a - z)).toEqual(
        Array.from({ length: count }, (_, i) => i + 1),
      );
    }
  });

  it("a bye matchup still wires into a round-2 parent slot", () => {
    const b = buildBracket(6);
    for (const m of b.matchups.filter((m) => m.isBye)) {
      expect(m.parentSlot).not.toBeNull();
      expect(m.parentSide).not.toBeNull();
    }
  });
});

describe("buildDoubleElimBracket (WSM-flex-brackets)", () => {
  it("rejects counts below 2", () => {
    expect(() => buildDoubleElimBracket(1)).toThrow("team_count_too_small");
  });

  it.each([4, 8, 16])(
    "size %i: winners bracket matches single-elim + one grand final",
    (count) => {
      const single = buildBracket(count);
      const de = buildDoubleElimBracket(count);
      expect(de.format).toBe("double");
      const wb = de.matchups.filter((m) => m.bracketType === "winners");
      expect(wb).toHaveLength(single.matchups.length);
      const gf = de.matchups.filter((m) => m.bracketType === "grandFinal");
      expect(gf).toHaveLength(1);
    },
  );

  it.each([
    // size, expected LB matchup count = size - 2 (a double-elim invariant)
    [4, 2],
    [8, 6],
    [16, 14],
  ])("size %i: losers bracket has size-2 matchups", (count, expected) => {
    const de = buildDoubleElimBracket(count);
    const lb = de.matchups.filter((m) => m.bracketType === "losers");
    expect(lb).toHaveLength(expected);
  });

  it("LB has 2*(wbRounds-1) rounds with consistent slot counts", () => {
    const de = buildDoubleElimBracket(8); // wbRounds 3 → lbRounds 4
    const lbRoundNums = [
      ...new Set(
        de.matchups
          .filter((m) => m.bracketType === "losers")
          .map((m) => m.round),
      ),
    ].sort((a, z) => a - z);
    expect(lbRoundNums).toEqual([1, 2, 3, 4]);
    const counts = lbRoundNums.map(
      (r) =>
        de.matchups.filter((m) => m.bracketType === "losers" && m.round === r)
          .length,
    );
    expect(counts).toEqual([2, 2, 1, 1]); // r1,r2 minor/feed; r3 major; r4 final
  });

  it("every WB matchup (except byes) routes its loser somewhere in the LB", () => {
    const de = buildDoubleElimBracket(8);
    const wb = de.matchups.filter((m) => m.bracketType === "winners");
    for (const m of wb) {
      if (m.isBye) {
        expect(m.loserParentRound ?? null).toBeNull();
        continue;
      }
      expect(m.loserParentRound).not.toBeNull();
      expect(m.loserParentSlot).not.toBeNull();
      expect(["home", "away"]).toContain(m.loserParentSide);
    }
  });

  it("WB-round-1 losers fill both sides of LB round 1", () => {
    const de = buildDoubleElimBracket(8);
    const r1Losers = de.matchups.filter(
      (m) => m.bracketType === "winners" && m.round === 1 && !m.isBye,
    );
    // 4 WB-r1 matchups → 4 losers → 2 LB-r1 matchups (home + away each).
    const sides = r1Losers.map(
      (m) => `${m.loserParentSlot}:${m.loserParentSide}`,
    );
    expect(new Set(sides).size).toBe(r1Losers.length); // no collisions
    for (const m of r1Losers) {
      expect(m.loserParentRound).toBe(1);
    }
  });

  it("WB final loser drops into the final LB round (away side)", () => {
    const de = buildDoubleElimBracket(8);
    const wbFinal = de.matchups.find(
      (m) => m.bracketType === "winners" && m.round === de.rounds,
    )!;
    expect(wbFinal.loserParentRound).toBe(4); // lbRounds for size 8
    expect(wbFinal.loserParentSide).toBe("away");
  });

  it("LB loser-routing targets always reference an existing LB matchup", () => {
    for (const count of [4, 8, 16]) {
      const de = buildDoubleElimBracket(count);
      const lbKeys = new Set(
        de.matchups
          .filter((m) => m.bracketType === "losers")
          .map((m) => `${m.round}:${m.slot}`),
      );
      for (const m of de.matchups.filter(
        (m) => m.bracketType === "winners" && !m.isBye,
      )) {
        expect(lbKeys.has(`${m.loserParentRound}:${m.loserParentSlot}`)).toBe(
          true,
        );
      }
    }
  });

  it("LB internal advancement targets always reference an existing LB matchup", () => {
    for (const count of [4, 8, 16]) {
      const de = buildDoubleElimBracket(count);
      const lb = de.matchups.filter((m) => m.bracketType === "losers");
      const lbKeys = new Set(lb.map((m) => `${m.round}:${m.slot}`));
      for (const m of lb) {
        if (m.parentSlot == null) continue; // LB final → grand final
        expect(lbKeys.has(`${m.round + 1}:${m.parentSlot}`)).toBe(true);
      }
    }
  });

  it("supports double-elim with byes (non-power-of-two count)", () => {
    const de = buildDoubleElimBracket(6); // size 8, 2 byes in WB
    const byes = de.matchups.filter(
      (m) => m.bracketType === "winners" && m.isBye,
    );
    expect(byes).toHaveLength(2);
    // Byes carry no loser routing.
    for (const m of byes) {
      expect(m.loserParentRound ?? null).toBeNull();
    }
  });
});
