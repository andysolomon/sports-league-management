/*
 * WSM-000164 — Single-elimination bracket construction.
 *
 * Pure functions isolated from Convex `db` so they can be unit-tested directly.
 * `generatePlayoffBracket` in `sports.ts` calls `buildBracket(size)` to lay out
 * the matchup tree, then inserts rows + wires `nextMatchupId` pointers from the
 * (round, slot) structure here.
 *
 * Sizes are powers of two ≥ 2 (the product restricts to 4/8/16). No byes.
 */

/** Side of a parent matchup a winner advances into. */
export type BracketSide = "home" | "away";

export interface BracketMatchupPlan {
  round: number; // 1-based; round === rounds is the final
  slot: number; // 0-based position within the round
  /** Round-1 seeds (1 = top seed). null for later rounds (TBD until played). */
  homeSeed: number | null;
  awaySeed: number | null;
  /** The (round+1) slot this winner feeds, and which side. null for the final. */
  parentSlot: number | null;
  parentSide: BracketSide | null;
}

export interface BracketPlan {
  size: number;
  rounds: number;
  matchups: BracketMatchupPlan[];
}

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

/**
 * Standard single-elimination seed order for round 1. Returns the seed sitting
 * at each round-1 position, arranged so the top two seeds land in opposite
 * halves and seed `i` meets seed `N+1-i` first. E.g. size 8 → [1,8,4,5,2,7,3,6].
 */
export function seedOrder(size: number): number[] {
  if (!isPowerOfTwo(size)) throw new Error("bracket_size_must_be_power_of_two");
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s, n + 1 - s);
    }
    order = next;
  }
  return order;
}

/**
 * Build the full bracket tree for `size` seeds. Round 1 carries the seeded
 * pairings (home = the higher/lower-numbered seed); later rounds are empty
 * placeholders whose teams resolve as games are played.
 */
export function buildBracket(size: number): BracketPlan {
  if (!isPowerOfTwo(size)) throw new Error("bracket_size_must_be_power_of_two");
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const matchups: BracketMatchupPlan[] = [];

  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round; // matchups in this round
    for (let slot = 0; slot < count; slot++) {
      const isFinal = round === rounds;
      let homeSeed: number | null = null;
      let awaySeed: number | null = null;
      if (round === 1) {
        const a = order[slot * 2];
        const b = order[slot * 2 + 1];
        // Higher seed (smaller number) hosts.
        homeSeed = Math.min(a, b);
        awaySeed = Math.max(a, b);
      }
      matchups.push({
        round,
        slot,
        homeSeed,
        awaySeed,
        parentSlot: isFinal ? null : Math.floor(slot / 2),
        parentSide: isFinal ? null : slot % 2 === 0 ? "home" : "away",
      });
    }
  }

  return { size, rounds, matchups };
}
