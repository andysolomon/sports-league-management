import { describe, it, expect } from "vitest";
import { seedOrder, buildBracket } from "../lib/bracket";

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

describe("buildBracket (WSM-000164)", () => {
  it.each([
    [4, 2, 3],
    [8, 3, 7],
    [16, 4, 15],
  ])("size %i → %i rounds and N-1 total matchups", (size, rounds, total) => {
    const b = buildBracket(size);
    expect(b.rounds).toBe(rounds);
    expect(b.matchups).toHaveLength(total);
    // Matchups per round halve each round.
    for (let r = 1; r <= rounds; r++) {
      expect(b.matchups.filter((m) => m.round === r)).toHaveLength(
        size / 2 ** r,
      );
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
    const r1 = b.matchups.filter((m) => m.round === 1).sort((a, z) => a.slot - z.slot);
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
    // Both round-1 slots 0 and 1 feed round-2 slot 0 (home + away).
    const feeders = b.matchups.filter((m) => m.round === 1 && m.parentSlot === 0);
    expect(feeders.map((m) => m.parentSide).sort()).toEqual(["away", "home"]);
  });
});
