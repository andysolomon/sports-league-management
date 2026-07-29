/*
 * Roster shaping: squads, position changes and who deserves a promotion
 * (Dynasty Mode B5).
 *
 * Pure and Convex-free. The rules live here because both ends need them and
 * need the same answer: the mutation ENFORCES them, and the panel uses them to
 * decide which buttons to offer. A panel that offered a move the mutation
 * rejects would be worse than one that offered nothing.
 *
 * ## Why `squad` is a rule and not a free-text field
 *
 * `players.squad` has existed since the HS model landed and nothing has ever
 * written to it deliberately — it is seeded by `squadForGrade`, which puts
 * every junior and senior on Varsity and coin-flips the rest. B5 is the first
 * mechanic that lets a coach disagree with that, so it is also the first place
 * the rule has to be stated rather than assumed:
 *
 *   - Grade 11 and 12 are ALWAYS Varsity. This is `squadForGrade`'s invariant,
 *     and B5 preserves rather than re-implements it: an upperclassman cannot be
 *     sent down. In a high-school program that is not a coaching decision,
 *     it is what JV means.
 *   - Grade 9 is ALWAYS JV. A freshman is not promotable, however good he is.
 *   - Grade 10 is the only genuine decision, which is exactly where a
 *     promotion mechanic should live.
 *
 * A player with no grade is not in the dynasty model at all, and B5 refuses to
 * guess one for him — see `squadChangeError`.
 */

import {
  attrWeight,
  attributeGroupForPosition,
  derivePositionGroup,
} from "./positions";

export const VARSITY = "Varsity";
export const JV = "JV";

/** The lowest grade that may be promoted to Varsity by a coach. */
export const MIN_PROMOTION_GRADE = 10;

/** The grade at and above which Varsity is mandatory, mirroring `squadForGrade`. */
export const MANDATORY_VARSITY_GRADE = 11;

export type Squad = typeof VARSITY | typeof JV;

export function isSquad(value: string): value is Squad {
  return value === VARSITY || value === JV;
}

export type SquadChangeRejection =
  | "invalid_squad"
  | "grade_unknown"
  | "grade_too_low_for_varsity"
  | "grade_requires_varsity";

export interface SquadChangeInput {
  grade: number | null;
  from: string | null;
  to: string;
}

export type SquadChangeDecision =
  | { ok: true; kind: "change" }
  /** Already on that squad — a retry of a request that landed. */
  | { ok: true; kind: "noop" }
  | { ok: false; reason: SquadChangeRejection };

/**
 * Whether a player may move to `to`.
 *
 * Returns a `noop` rather than an error when he is already there, mirroring
 * `phaseGate` in `offseasonPhases.ts`: a double-submitted move is not a
 * failure, it is a request that was already satisfied. Two concurrency idioms
 * for the same shape in one feature is how off-by-one bugs get written.
 */
export function squadChange(input: SquadChangeInput): SquadChangeDecision {
  if (!isSquad(input.to)) return { ok: false, reason: "invalid_squad" };
  if (input.from === input.to) return { ok: true, kind: "noop" };

  /*
   * Honest absence: a null grade means this player is not modelled as a
   * high-school student, not that he is a freshman. Defaulting him to a grade
   * would invent the fact the whole rule turns on.
   */
  if (input.grade === null) return { ok: false, reason: "grade_unknown" };

  if (input.to === VARSITY && input.grade < MIN_PROMOTION_GRADE) {
    return { ok: false, reason: "grade_too_low_for_varsity" };
  }
  if (input.to === JV && input.grade >= MANDATORY_VARSITY_GRADE) {
    return { ok: false, reason: "grade_requires_varsity" };
  }
  return { ok: true, kind: "change" };
}

/* ── Position fit ──────────────────────────────────────────────────────── */

/** Attribute ceiling — the scale `positionChangeFit` normalises against. */
const ATTRIBUTE_MAX = 99;

export interface PositionFitInput {
  toPosition: string;
  /** The player's ratings. Keys absent from his profile are absent, not zero. */
  attributes: Readonly<Record<string, number>>;
}

/**
 * How well a player suits a position, from 0 to 1.
 *
 * Scored over the attributes he HAS, weighted by what the target position
 * leans on. A quarterback moving to cornerback has no coverage ratings at all,
 * and the honest reading of that is not "he covers at zero" — it is that he
 * has to be judged on the athleticism he demonstrably has: speed, agility,
 * awareness. Which is how a real coach judges the same move.
 *
 * Treating a missing attribute as 0 would make every cross-group move score
 * near-zero and the control would be decoration. Treating it as average would
 * invent a rating. Leaving it out of both sides of the ratio is the only
 * reading that adds no information that is not there.
 *
 * An unrecognised position scores 0: nothing is known about a position that
 * does not exist, and offering a fit for it would be a fabrication.
 */
export function positionChangeFit(input: PositionFitInput): number {
  if (derivePositionGroup(input.toPosition) === null) return 0;
  const group = attributeGroupForPosition(input.toPosition);

  let weighted = 0;
  let weightSum = 0;
  for (const [key, value] of Object.entries(input.attributes)) {
    if (!Number.isFinite(value)) continue;
    const weight = attrWeight(group, key);
    weighted += value * weight;
    weightSum += weight;
  }
  if (weightSum === 0) return 0;

  const fit = weighted / (weightSum * ATTRIBUTE_MAX);
  return Math.min(1, Math.max(0, fit));
}

/* ── Promotion recommendations ─────────────────────────────────────────── */

export interface RosterPlayer {
  playerId: string;
  name: string;
  position: string;
  grade: number | null;
  squad: string | null;
  overall: number | null;
}

export interface PromotionRecommendation {
  playerId: string;
  name: string;
  position: string;
  overall: number;
  /** The Varsity player he would leapfrog, or null when nobody plays there. */
  replacesPlayerId: string | null;
  replacesName: string | null;
  /** Rating points he adds at the position. */
  margin: number;
}

/**
 * Who on JV has outgrown it.
 *
 * The argument a recommendation makes is comparative, never "he is good": a
 * player is worth promoting when he is better than the WEAKEST Varsity player
 * at his position, because that is the man he would actually replace. A list
 * ranked by raw rating would recommend the same handful of athletes every year
 * regardless of whether the roster needed them.
 *
 * An unmanned position is the strongest case of all and sorts first — there is
 * nobody there at all, so the comparison has no incumbent to beat.
 *
 * Pure and total: no RNG, no clock, stable ties. Same roster in, same list out.
 */
export function recommendPromotions(
  roster: readonly RosterPlayer[],
): PromotionRecommendation[] {
  const weakestVarsity = new Map<string, RosterPlayer>();
  for (const player of roster) {
    if (player.squad !== VARSITY || player.overall === null) continue;
    const held = weakestVarsity.get(player.position);
    if (!held || (held.overall ?? 0) > player.overall) {
      weakestVarsity.set(player.position, player);
    }
  }

  const out: PromotionRecommendation[] = [];
  for (const player of roster) {
    if (player.squad !== JV || player.overall === null) continue;
    if (squadChange({ grade: player.grade, from: player.squad, to: VARSITY }).ok !== true) {
      continue;
    }

    const incumbent = weakestVarsity.get(player.position) ?? null;
    const margin = player.overall - (incumbent?.overall ?? 0);
    if (incumbent && margin <= 0) continue;

    out.push({
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      overall: player.overall,
      replacesPlayerId: incumbent?.playerId ?? null,
      replacesName: incumbent?.name ?? null,
      margin,
    });
  }

  return out.sort((a, b) => {
    const openA = a.replacesPlayerId === null ? 0 : 1;
    const openB = b.replacesPlayerId === null ? 0 : 1;
    if (openA !== openB) return openA - openB;
    if (a.margin !== b.margin) return b.margin - a.margin;
    return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
  });
}
