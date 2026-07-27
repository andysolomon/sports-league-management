import type { PbpPlayType } from "./types";

/*
 * Penalties (Dynasty Mode A2).
 *
 * Pure: no engine state, no I/O, no `Math.random`. The caller supplies the
 * PRNG so the whole thing stays inside the engine's deterministic sequence, and
 * every function here is unit-testable on its own.
 *
 * ## The rule that matters most
 *
 * A penalty is a CHOICE, not an outcome. The team that did NOT commit it
 * decides whether to accept the yardage or decline and keep the play. Modelling
 * the flag without the choice would be worse than not modelling it at all — a
 * defense would be punished for a holding call on a play it stuffed for a loss.
 *
 * `acceptOrDecline` is therefore deterministic: it compares the two outcomes and
 * takes the better one for the choosing team. No random draw, so it costs
 * nothing when the feature is off and never surprises a replay.
 */

export interface PenaltyDef {
  code: string;
  label: string;
  /** Yards assessed against the offending team. */
  yards: number;
  /** True when the offense committed it. */
  onOffense: boolean;
  /**
   * Whistled before the snap, so there is no play to keep — the down replays.
   * A pre-snap flag is always "accepted": there is no alternative outcome.
   */
  preSnap: boolean;
  /**
   * Accepting wipes the play's result and its stats. True for live-ball
   * offensive fouls (holding erases the run it sprang).
   */
  negatesPlay: boolean;
  /** Defensive fouls that award an automatic first down. */
  automaticFirstDown: boolean;
  /** Relative frequency weight. Normalized against the rest of the table. */
  weight: number;
}

/*
 * Rates are tuned so a league averages roughly 5-7 flags per team per game,
 * which is where high-school football actually sits. `PENALTY_RATE_PER_PLAY`
 * scales the whole table at once — tune that rather than individual weights.
 */
export const PENALTY_RATE_PER_PLAY = 0.085;

export const PENALTY_TABLE: readonly PenaltyDef[] = [
  {
    code: "false_start",
    label: "False start",
    yards: 5,
    onOffense: true,
    preSnap: true,
    negatesPlay: true,
    automaticFirstDown: false,
    weight: 22,
  },
  {
    code: "offside",
    label: "Offside",
    yards: 5,
    onOffense: false,
    preSnap: true,
    negatesPlay: true,
    automaticFirstDown: false,
    weight: 12,
  },
  {
    code: "delay_of_game",
    label: "Delay of game",
    yards: 5,
    onOffense: true,
    preSnap: true,
    negatesPlay: true,
    automaticFirstDown: false,
    weight: 7,
  },
  {
    code: "holding_offense",
    label: "Offensive holding",
    yards: 10,
    onOffense: true,
    preSnap: false,
    negatesPlay: true,
    automaticFirstDown: false,
    weight: 20,
  },
  {
    code: "holding_defense",
    label: "Defensive holding",
    yards: 5,
    onOffense: false,
    preSnap: false,
    negatesPlay: false,
    automaticFirstDown: true,
    weight: 8,
  },
  {
    code: "pass_interference",
    label: "Pass interference",
    yards: 15,
    onOffense: false,
    preSnap: false,
    negatesPlay: false,
    automaticFirstDown: true,
    weight: 7,
  },
  {
    code: "face_mask",
    label: "Face mask",
    yards: 15,
    onOffense: false,
    preSnap: false,
    negatesPlay: false,
    automaticFirstDown: true,
    weight: 5,
  },
  {
    code: "illegal_block",
    label: "Illegal block in the back",
    yards: 10,
    onOffense: true,
    preSnap: false,
    negatesPlay: true,
    automaticFirstDown: false,
    weight: 9,
  },
  {
    code: "unsportsmanlike",
    label: "Unsportsmanlike conduct",
    yards: 15,
    onOffense: false,
    preSnap: false,
    negatesPlay: false,
    automaticFirstDown: true,
    weight: 3,
  },
];

/** Play types that can never draw a flag in this model. */
const UNFLAGGABLE: ReadonlySet<PbpPlayType> = new Set<PbpPlayType>([
  "extra_point",
  "extra_point_miss",
  "two_point_convert",
  "two_point_fail",
  "safety",
  "kneel",
  "spike",
  "timeout",
  "penalty",
]);

/**
 * Discipline multiplier from a team's mean awareness.
 *
 * A 50-AWR team draws flags at the base rate; higher awareness suppresses them
 * and lower awareness inflates them, bounded so no roster is either
 * penalty-proof or unplayable.
 */
export function disciplineMultiplier(meanAwareness: number): number {
  const centered = (50 - meanAwareness) / 50;
  return Math.max(0.55, Math.min(1.6, 1 + centered * 0.6));
}

export interface RolledPenalty {
  def: PenaltyDef;
  /** Yards assessed, already signed from the offense's perspective. */
  yards: number;
}

/**
 * Roll for a flag on a single play.
 *
 * Returns `null` far more often than not. The caller MUST only invoke this when
 * the penalty feature is enabled — it draws from the PRNG, and drawing while
 * disabled would desynchronize every later play (see the golden-parity test).
 */
export function rollPenalty(input: {
  rand: () => number;
  playType: PbpPlayType;
  offenseDiscipline: number;
  defenseDiscipline: number;
}): RolledPenalty | null {
  if (UNFLAGGABLE.has(input.playType)) return null;

  // One draw decides whether there is a flag at all, so a clean play costs
  // exactly one number regardless of table size.
  const offenseMult = disciplineMultiplier(input.offenseDiscipline);
  const defenseMult = disciplineMultiplier(input.defenseDiscipline);
  const rate = PENALTY_RATE_PER_PLAY * ((offenseMult + defenseMult) / 2);
  if (input.rand() >= rate) return null;

  // Weight the table by which side is the sloppier one, so discipline changes
  // WHO gets flagged and not merely how often.
  const totalWeight = PENALTY_TABLE.reduce((sum, def) => {
    const sideMult = def.onOffense ? offenseMult : defenseMult;
    return sum + def.weight * sideMult;
  }, 0);

  let target = input.rand() * totalWeight;
  for (const def of PENALTY_TABLE) {
    const sideMult = def.onOffense ? offenseMult : defenseMult;
    target -= def.weight * sideMult;
    if (target <= 0) {
      return { def, yards: def.yards };
    }
  }
  // Floating-point tail: fall back to the most common flag rather than null,
  // so a rolled penalty is never silently dropped.
  return { def: PENALTY_TABLE[0]!, yards: PENALTY_TABLE[0]!.yards };
}

export interface AcceptDecision {
  accepted: boolean;
  /** Why, for the play-by-play text and for debugging a surprising call. */
  reason: string;
}

/**
 * Would the non-offending team rather have the flag or the play?
 *
 * Deterministic — no random draw. A coach who declines a holding call that
 * gained 12 yards is not being unlucky, they are being correct.
 */
export function acceptOrDecline(input: {
  penalty: PenaltyDef;
  /** Yards the play gained from the offense's perspective. */
  playYards: number;
  playIsScoring: boolean;
  playIsTurnover: boolean;
  distance: number;
}): AcceptDecision {
  const { penalty } = input;

  if (penalty.preSnap) {
    // Nothing happened yet — there is no play to weigh it against.
    return { accepted: true, reason: "pre-snap" };
  }

  if (penalty.onOffense) {
    // The DEFENSE chooses. Accepting wipes the play.
    if (input.playIsTurnover) {
      // Never give back a takeaway for 10 yards.
      return { accepted: false, reason: "declined to keep the turnover" };
    }
    if (input.playIsScoring) {
      return { accepted: true, reason: "accepted to wipe the score" };
    }
    if (input.playYards <= -penalty.yards) {
      // The play already lost more than the flag is worth.
      return { accepted: false, reason: "declined, play lost more" };
    }
    return { accepted: true, reason: "accepted to erase the gain" };
  }

  // The OFFENSE chooses on a defensive foul.
  if (input.playIsScoring) {
    return { accepted: false, reason: "declined to keep the score" };
  }
  if (input.playIsTurnover) {
    // Wiping away your own turnover is always right.
    return { accepted: true, reason: "accepted to erase the turnover" };
  }
  /*
   * Compare the two outcomes on the thing that actually matters — whether the
   * chains move — and fall back to raw yardage when both options agree.
   *
   * The subtle case: defensive holding carries an automatic first down, so it
   * is tempting to always accept it. But a 20-yard gain on 3rd-and-10 ALSO
   * produced a first down, 15 yards further downfield. Accepting there would
   * hand yards back for nothing.
   */
  const firstDownFromPenalty =
    penalty.automaticFirstDown || penalty.yards >= input.distance;
  const firstDownFromPlay = input.playYards >= input.distance;

  if (firstDownFromPlay && !firstDownFromPenalty) {
    return { accepted: false, reason: "declined, play made the line" };
  }
  if (firstDownFromPenalty && !firstDownFromPlay) {
    return { accepted: true, reason: "accepted for the first down" };
  }
  // Both move the chains, or neither does: take the better field position.
  if (input.playYards >= penalty.yards) {
    return { accepted: false, reason: "declined, play gained more" };
  }
  return { accepted: true, reason: "accepted" };
}

/** Mean awareness across a roster, falling back to a supplied default. */
export function meanAwareness(
  players: ReadonlyArray<{ awareness?: number; overall: number }>,
  fallback: number,
): number {
  if (players.length === 0) return fallback;
  const values = players.map((p) =>
    typeof p.awareness === "number" ? p.awareness : p.overall,
  );
  return values.reduce((a, b) => a + b, 0) / values.length;
}
