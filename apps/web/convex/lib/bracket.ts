/*
 * WSM-000164 — Single-elimination bracket construction.
 * WSM-flex-brackets — arbitrary team counts (byes) + double-elimination.
 *
 * Pure functions isolated from Convex `db` so they can be unit-tested directly.
 * `generatePlayoffBracket` in `sports.ts` calls `buildBracket(teamCount)` (or
 * `buildDoubleElimBracket`) to lay out the matchup tree, then inserts rows +
 * wires `nextMatchupId` / `loserNextMatchupId` pointers from the structure here.
 *
 * Bracket size is the next power of two ≥ teamCount. When size > teamCount the
 * top `(size - teamCount)` seeds get first-round byes: the bye team auto-advances
 * (no game / fixture) and is pre-placed into its round-2 parent slot.
 */

/** Side of a parent matchup a winner advances into. */
export type BracketSide = "home" | "away";

/** Which sub-bracket a matchup belongs to (double-elim). Single-elim omits it. */
export type BracketType = "winners" | "losers" | "grandFinal";

export interface BracketMatchupPlan {
  round: number; // 1-based; round === rounds is the final
  slot: number; // 0-based position within the round
  /** Round-1 seeds (1 = top seed). null for later rounds (TBD until played). */
  homeSeed: number | null;
  awaySeed: number | null;
  /** The parent (round+1) slot this winner feeds, and which side. null = final. */
  parentSlot: number | null;
  parentSide: BracketSide | null;
  /**
   * True when this matchup is a first-round bye: a single present team that
   * auto-advances. `homeSeed` carries that team; `awaySeed` is null. No fixture
   * is spawned and the winner is set immediately at generation time.
   */
  isBye?: boolean;
  /** Sub-bracket marker (double-elim only). Undefined for single-elim. */
  bracketType?: BracketType;
  /**
   * Double-elim only: where the LOSER of this matchup drops to. Identifies the
   * target matchup by (bracketType, round, slot) + which side. null when the
   * loser is eliminated (losers-bracket games + the grand final).
   */
  loserParentRound?: number | null;
  loserParentSlot?: number | null;
  loserParentSide?: BracketSide | null;
}

export interface BracketPlan {
  size: number;
  rounds: number;
  matchups: BracketMatchupPlan[];
  /** "single" | "double" — present for double-elim plans. */
  format?: "single" | "double";
}

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

/** Smallest power of two ≥ n (n ≥ 2). */
export function nextPowerOfTwo(n: number): number {
  if (n < 2) throw new Error("team_count_too_small");
  let size = 2;
  while (size < n) size *= 2;
  return size;
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
 * Build the single-elimination bracket tree for `teamCount` teams (≥ 2). The
 * bracket size is the next power of two ≥ teamCount; the top `(size-teamCount)`
 * seeds get first-round byes (auto-advanced, no fixture). Round 1 carries the
 * seeded pairings (higher seed hosts); later rounds resolve as games are played.
 */
export function buildBracket(teamCount: number): BracketPlan {
  if (teamCount < 2) throw new Error("team_count_too_small");
  const size = nextPowerOfTwo(teamCount);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const matchups: BracketMatchupPlan[] = [];

  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round; // matchups in this round
    for (let slot = 0; slot < count; slot++) {
      const isFinal = round === rounds;
      let homeSeed: number | null = null;
      let awaySeed: number | null = null;
      let isBye = false;
      if (round === 1) {
        const a = order[slot * 2];
        const b = order[slot * 2 + 1];
        // Higher seed (smaller number) hosts.
        const high = Math.min(a, b);
        const low = Math.max(a, b);
        // A "seed" beyond teamCount is a phantom: the present team gets a bye.
        if (low > teamCount) {
          homeSeed = high; // the real, present team
          awaySeed = null;
          isBye = true;
        } else {
          homeSeed = high;
          awaySeed = low;
        }
      }
      matchups.push({
        round,
        slot,
        homeSeed,
        awaySeed,
        parentSlot: isFinal ? null : Math.floor(slot / 2),
        parentSide: isFinal ? null : slot % 2 === 0 ? "home" : "away",
        ...(isBye ? { isBye: true } : {}),
      });
    }
  }

  return { size, rounds, matchups };
}

/**
 * Build a DOUBLE-elimination bracket for `teamCount` teams (≥ 2).
 *
 * Layout:
 *   - Winners bracket (WB): identical to the single-elim tree (with byes).
 *   - Losers bracket (LB): a team is eliminated only after a second loss. LB
 *     rounds alternate "minor" (LB survivors meet WB drop-ins) and "major"
 *     (LB survivors meet each other). Built generically for any size.
 *   - Grand final (GF): WB champion vs LB champion — a SINGLE game (no bracket
 *     reset / "if-necessary" second game). This is a deliberate simplification.
 *
 * Each matchup carries `bracketType`. WB matchups carry loser-routing pointers
 * (`loserParent*`) into the LB. The convex layer drops a WB loser into the
 * referenced LB slot. The GF home = WB champion, away = LB champion.
 */
export function buildDoubleElimBracket(teamCount: number): BracketPlan {
  if (teamCount < 2) throw new Error("team_count_too_small");
  const size = nextPowerOfTwo(teamCount);
  const wbRounds = Math.log2(size); // winners-bracket rounds

  // 1. Winners bracket — reuse the single-elim tree, tagged "winners".
  const wb = buildBracket(teamCount).matchups.map((m) => ({
    ...m,
    bracketType: "winners" as const,
  }));

  // 2. Losers bracket. For a size-N WB with R = log2(N) rounds, the LB has
  //    2*(R-1) rounds. The number of matchups in each LB round follows the
  //    classic pattern of minor/major rounds, each holding N / 2^ceil((r+1)/2).
  //    We build it generically and wire WB-loser drop-ins per round.
  const lb: BracketMatchupPlan[] = [];
  const lbRounds = wbRounds > 1 ? 2 * (wbRounds - 1) : 0;

  // Slots per LB round: LB round r (1-based).
  //   minor rounds (odd r): receive WB drop-ins, count = size / 2^((r+1)/2 + 1)
  //   major rounds (even r): LB-only, count = size / 2^(r/2 + 1)
  // Equivalently both reduce to size / 2^(floor(r/2) + 2) ... derive directly:
  const lbCount = (r: number): number => {
    // round 1 has size/4 matchups (losers of WB round 1, paired up),
    // then the count halves every TWO rounds.
    const pairExp = Math.floor((r + 1) / 2); // 1,1,2,2,3,3,...
    return size / 2 ** (pairExp + 1);
  };

  for (let r = 1; r <= lbRounds; r++) {
    const count = lbCount(r);
    for (let slot = 0; slot < count; slot++) {
      const isLast = r === lbRounds;
      lb.push({
        round: r,
        slot,
        homeSeed: null,
        awaySeed: null,
        bracketType: "losers",
        // LB winner advances to the next LB round (same slot in major→minor
        // collapse, slot/2 when the round halves). null on the last LB round
        // (its winner goes to the grand final, handled by convex via GF).
        parentSlot: isLast ? null : nextLbSlot(r, slot),
        parentSide: isLast ? null : nextLbSide(r, slot),
      });
    }
  }

  // 3. Grand final — single game. WB champion (home) vs LB champion (away).
  const gf: BracketMatchupPlan = {
    round: 1,
    slot: 0,
    homeSeed: null,
    awaySeed: null,
    parentSlot: null,
    parentSide: null,
    bracketType: "grandFinal",
  };

  // 4. Wire WB loser routing into the LB.
  //    WB round 1 losers feed LB round 1 (two losers per LB-r1 matchup).
  //    WB round k (k≥2) losers feed LB minor round (2k-2), one per slot.
  for (const m of wb) {
    if (m.isBye) continue; // bye matchups have no loser
    const k = m.round;
    if (k === wbRounds) {
      // WB final loser drops into the final LB round (the LB final's away slot).
      m.loserParentRound = lbRounds;
      m.loserParentSlot = 0;
      m.loserParentSide = "away";
      continue;
    }
    if (k === 1) {
      // Two WB-r1 losers per LB-r1 matchup: slot s/2, alternating home/away.
      m.loserParentRound = 1;
      m.loserParentSlot = Math.floor(m.slot / 2);
      m.loserParentSide = m.slot % 2 === 0 ? "home" : "away";
    } else {
      // WB round k loser → LB minor round (2k-2), one per slot, into the
      // "away" slot (the LB survivor occupies "home" via LB advancement).
      m.loserParentRound = 2 * k - 2;
      m.loserParentSlot = m.slot;
      m.loserParentSide = "away";
    }
  }

  const matchups = [...wb, ...lb, gf];
  return { size, rounds: wbRounds, matchups, format: "double" };
}

/** LB advancement: which slot in the next LB round a winner of (r, slot) goes to. */
function nextLbSlot(r: number, slot: number): number {
  // Minor rounds (odd) feed the major round at the SAME slot count → same slot.
  // Major rounds (even) halve into the next minor round → slot/2.
  return r % 2 === 1 ? slot : Math.floor(slot / 2);
}

/** LB advancement side: LB survivor always occupies "home"; drop-in fills "away". */
function nextLbSide(r: number, slot: number): BracketSide {
  // After a minor round, the survivor advances into the major round as "home".
  // After a major round, two survivors collapse into the next minor round;
  // even slot → home, odd slot → away.
  if (r % 2 === 1) return "home";
  return slot % 2 === 0 ? "home" : "away";
}
