import type { PbpPlayType } from "./types";

/*
 * Injuries (Dynasty Mode A4).
 *
 * Pure. The caller supplies the random draws, which keeps this module testable
 * without a PRNG and — more importantly — keeps the number of draws an injury
 * roll costs VISIBLE at the call site. The engine's random sequence is shared,
 * so a mechanic that quietly draws a variable number of values would make every
 * later play depend on whether someone got hurt.
 *
 * Exactly two draws per roll, always: one for whether, one for how bad.
 */

export type InjurySeverity = "minor" | "moderate" | "major" | "severe";

export interface InjurySpec {
  /** Share of injuries at this severity. Weights sum to 1. */
  weight: number;
  /** Inclusive range of TEAM GAMES missed. */
  minGames: number;
  maxGames: number;
  label: string;
}

/**
 * Severity distribution.
 *
 * Weighted hard toward the low end because that is what a season looks like:
 * mostly knocks that cost a week, occasionally something that ends a year. A
 * flat distribution would retire half a roster by Week 8.
 *
 * `minor` costs ZERO games — the player is shaken up, leaves the field, and is
 * back next week. It exists so the news feed and the Gamecast have something to
 * report that is not a catastrophe.
 */
export const INJURY_TABLE: Record<InjurySeverity, InjurySpec> = {
  minor: { weight: 0.55, minGames: 0, maxGames: 0, label: "Day to day" },
  moderate: { weight: 0.28, minGames: 1, maxGames: 2, label: "Week to week" },
  major: { weight: 0.13, minGames: 3, maxGames: 6, label: "Out multiple weeks" },
  severe: { weight: 0.04, minGames: 7, maxGames: 12, label: "Out for the season" },
};

const SEVERITY_ORDER: readonly InjurySeverity[] = [
  "minor",
  "moderate",
  "major",
  "severe",
];

/**
 * Base chance that a play produces an injury, before fatigue and contact.
 *
 * Calibrated for the balance band's 0–2 injuries per game: roughly 110 plays a
 * game, so a base near 0.008 lands about one injury per game once the contact
 * and fatigue multipliers are applied.
 */
const BASE_INJURY_RATE = 0.008;

/** How violent a play is, relative to a normal snap. */
const CONTACT_MULTIPLIER: Partial<Record<PbpPlayType, number>> = {
  rush: 1.3,
  sack: 2.1,
  pass_complete: 1.1,
  pass_incomplete: 0.45,
  interception: 1.2,
  kickoff: 1.6,
  punt: 0.9,
  two_point_convert: 1.3,
  two_point_fail: 1.3,
  onside_kick: 1.8,
  field_goal: 0.2,
  extra_point: 0.15,
  kneel: 0.05,
  spike: 0.05,
};

export function contactFactor(playType: PbpPlayType): number {
  return CONTACT_MULTIPLIER[playType] ?? 0;
}

export interface InjuryRollInput {
  playType: PbpPlayType;
  /** Remaining stamina of the player exposed, in `[0, 1]`. */
  stamina: number;
  /**
   * League severity dial (`dynastyConfig.injurySeverityScale`): 0 none,
   * 1 normal, 2 brutal. At 0 this function can never return an injury, which
   * is what makes the knob a true off switch rather than a rare-events mode.
   */
  severityScale: number;
  /** Two draws in `[0, 1)`: whether, then how bad. */
  rolls: readonly [number, number];
}

export interface InjuryOutcome {
  severity: InjurySeverity;
  gamesOut: number;
  label: string;
}

/**
 * Did this play hurt someone, and how badly?
 *
 * Tired players get hurt more — the fatigue multiplier reaches 2.2x at zero
 * stamina. That link is the reason fatigue is worth modelling at all: without
 * it, running a back into the ground has no cost beyond a few rating points.
 */
export function rollInjury(input: InjuryRollInput): InjuryOutcome | null {
  if (input.severityScale <= 0) return null;

  const contact = contactFactor(input.playType);
  if (contact <= 0) return null;

  const fatigue = 1 + (1 - clamp(input.stamina, 0, 1)) * 1.2;
  const chance = BASE_INJURY_RATE * contact * fatigue * clamp(input.severityScale, 0, 2);

  if (input.rolls[0] >= chance) return null;

  const severity = pickSeverity(input.rolls[1], input.severityScale);
  const spec = INJURY_TABLE[severity];
  /*
   * `gamesOut` is drawn from the SAME roll that chose the severity rather than
   * a third draw. Two draws per roll keeps the PRNG cost of an injury check
   * constant whether or not anyone gets hurt — a variable cost would make every
   * subsequent play depend on the injury outcome.
   */
  const spread = spec.maxGames - spec.minGames;
  const within = spread === 0 ? 0 : Math.round(fractional(input.rolls[1]) * spread);
  return {
    severity,
    gamesOut: spec.minGames + within,
    label: spec.label,
  };
}

/**
 * Choose a severity band.
 *
 * A brutal league (`severityScale` 2) shifts weight toward the top of the table
 * rather than merely producing more injuries — otherwise "brutal" would just
 * mean "more day-to-day knocks", which nobody would notice.
 */
function pickSeverity(roll: number, severityScale: number): InjurySeverity {
  const skew = clamp(severityScale, 0, 2) - 1; // -1 gentle, 0 normal, +1 brutal
  let cumulative = 0;
  const weights = SEVERITY_ORDER.map((severity, index) => {
    // Later (worse) bands get more weight as `skew` rises.
    const tilt = 1 + skew * (index / (SEVERITY_ORDER.length - 1) - 0.35);
    return INJURY_TABLE[severity].weight * Math.max(0.05, tilt);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const target = clamp(roll, 0, 0.999999) * total;
  for (let i = 0; i < SEVERITY_ORDER.length; i++) {
    cumulative += weights[i];
    if (target < cumulative) return SEVERITY_ORDER[i];
  }
  return "minor";
}

/** The fractional part, used to reuse one draw for two independent choices. */
function fractional(n: number): number {
  return (n * 997) % 1;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface InjuryRecord {
  /** Team games still to be missed. The authoritative countdown. */
  gamesOut: number;
  status: string;
}

/**
 * Is a player available?
 *
 * Availability counts GAMES, not weeks. A team with a bye does not heal anyone
 * — the player misses the number of games he was given, whenever those games
 * happen. `returnsAfterWeek` is stored alongside as the projection shown in the
 * UI ("back after Week 9"), but it is a forecast, not the rule: a bye or a
 * rescheduled fixture moves the real return date and the countdown follows.
 */
export function isAvailable(
  injury: InjuryRecord | null | undefined,
): boolean {
  if (!injury) return true;
  if (injury.status !== "out") return true;
  return injury.gamesOut <= 0;
}

/**
 * Projected return week for an injury sustained in `week`.
 *
 * Assumes no byes, which is why it is a projection. Nothing decides
 * availability from it.
 */
export function projectedReturnWeek(week: number, gamesOut: number): number {
  return week + Math.max(0, gamesOut);
}
