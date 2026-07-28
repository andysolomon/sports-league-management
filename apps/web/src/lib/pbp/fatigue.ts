import type { PbpPlayType, PlayerSimProfile } from "./types";

/*
 * Fatigue and durability (Dynasty Mode A4).
 *
 * Pure, and deliberately CONSUMES NO RANDOMNESS. Fatigue is a function of the
 * snaps a player has already taken, so it can be recomputed at any point in a
 * game without touching the PRNG. That matters more than it looks: the engine's
 * random sequence is shared by every mechanic, so a single stray `rand()` here
 * would shift every later draw and break golden parity for reasons that have
 * nothing to do with fatigue.
 *
 * ## What this models
 *
 * A workhorse back who carries 25 times is worse in the fourth quarter than he
 * was in the first, and a team with no second back has no way out of that. The
 * point is not the tiredness itself — it is that ROSTER DEPTH becomes a real
 * decision instead of a number nobody reads.
 */

/**
 * How much a snap costs the players involved in it.
 *
 * A carry costs more than a pass drop-back because someone hits you at the end
 * of it. These are relative weights, not seconds or calories — only their ratio
 * matters, and `STAMINA_BUDGET` sets the absolute scale.
 */
const SNAP_COSTS: Partial<Record<PbpPlayType, number>> = {
  rush: 1.35,
  pass_complete: 1,
  pass_incomplete: 0.8,
  sack: 1.25,
  interception: 1.1,
  kickoff: 0.9,
  punt: 0.6,
  field_goal: 0.3,
  extra_point: 0.2,
  two_point_convert: 1,
  two_point_fail: 1,
  onside_kick: 0.9,
  kneel: 0.3,
  spike: 0.2,
};

/** Plays with no snap of their own cost nothing. */
const FREE_PLAYS: ReadonlySet<PbpPlayType> = new Set([
  "timeout",
  "penalty",
  "safety",
]);

export function snapCost(playType: PbpPlayType): number {
  if (FREE_PLAYS.has(playType)) return 0;
  return SNAP_COSTS[playType] ?? 1;
}

/**
 * Accumulated snap cost at which an average player is fully gassed.
 *
 * Tuned against a real workload: a feature back sees roughly 25 carries plus a
 * dozen pass snaps in a full game, which lands near this budget — so the
 * heaviest-used player on a team finishes tired and everyone else does not.
 */
const STAMINA_BUDGET = 46;

/** Endurance below which a player tires faster; above which, slower. */
const NEUTRAL_ENDURANCE = 70;

/**
 * Remaining stamina in `[0, 1]` after `accumulated` snap cost.
 *
 * Linear rather than exponential on purpose. An exponential curve spends most
 * of its range in a region nobody reaches and then falls off a cliff, which
 * reads as a bug when a starter collapses in one drive.
 *
 * `endurance` is the player's rating when known. Absence means average — never
 * zero, which would make an unrated player tire instantly.
 */
export function staminaDecay(
  accumulated: number,
  endurance?: number,
): number {
  const rating = endurance ?? NEUTRAL_ENDURANCE;
  // A 99-endurance player lasts about 40% longer than a 40-endurance one.
  const budget = STAMINA_BUDGET * (0.7 + (clamp(rating, 0, 99) / 99) * 0.6);
  return clamp(1 - accumulated / budget, 0, 1);
}

/** The most an exhausted player loses off their rating. */
const MAX_FATIGUE_PENALTY = 14;

/**
 * A player's rating adjusted for how tired they are.
 *
 * Never drops below 40: a gassed starter is still a varsity player, and letting
 * this approach zero would make the engine's weighted selection behave as if he
 * had left the field.
 */
export function effectiveOverall(
  overall: number,
  stamina: number,
): number {
  const penalty = (1 - clamp(stamina, 0, 1)) * MAX_FATIGUE_PENALTY;
  return Math.max(40, Math.round(overall - penalty));
}

/** Stamina below which the engine looks for a fresh body. */
const SUB_THRESHOLD = 0.55;

/**
 * Who should come in for a tired starter, if anyone.
 *
 * Returns `null` when the starter is fine OR when there is nobody better to
 * bring on — a team with no depth simply plays its tired starter, which is the
 * whole consequence this mechanic exists to create. It does NOT return a worse
 * player just to rotate.
 *
 * `candidates` must be in depth order, which is how `playersInGroup` supplies
 * them.
 */
export function substitutionCandidate(
  candidates: readonly PlayerSimProfile[],
  staminaOf: (player: PlayerSimProfile) => number,
): PlayerSimProfile | null {
  if (candidates.length < 2) return null;

  const starter = candidates[0];
  const starterStamina = staminaOf(starter);
  if (starterStamina >= SUB_THRESHOLD) return null;

  const starterEffective = effectiveOverall(starter.overall, starterStamina);
  let best: PlayerSimProfile | null = null;
  let bestEffective = starterEffective;

  for (const candidate of candidates.slice(1)) {
    const effective = effectiveOverall(candidate.overall, staminaOf(candidate));
    if (effective > bestEffective) {
      best = candidate;
      bestEffective = effective;
    }
  }
  return best;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Running snap-cost totals for one game, keyed by player id. */
export type SnapLedger = Map<string, number>;

export function chargeSnap(
  ledger: SnapLedger,
  playerId: string,
  cost: number,
): void {
  if (cost <= 0) return;
  ledger.set(playerId, (ledger.get(playerId) ?? 0) + cost);
}

export function staminaFor(
  ledger: SnapLedger,
  player: PlayerSimProfile,
): number {
  return staminaDecay(ledger.get(player.playerId) ?? 0, player.endurance);
}
