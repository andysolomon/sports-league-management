import {
  defenseTendencies,
  offenseTendencies,
  type DefenseTendencies,
  type OffenseTendencies,
} from "@/lib/program/schemes";

/*
 * Schemes in the simulator (Dynasty Mode A6).
 *
 * The join between Pillar A and Pillar C. `src/lib/program/schemes.ts` says
 * what a Flexbone WANTS to do; this module says what that does to a football
 * game. Neither knows the other's numbers.
 *
 * Pure, and — like `weather.ts` and `crowd.ts` — it CONSUMES NO RANDOMNESS.
 * Scheme is a property of the matchup, resolved once when the game starts.
 *
 * ## The identity contract
 *
 * `schemeModifiers(undefined, undefined)` and `schemeModifiers` of two balanced
 * schemes both return `NEUTRAL_SCHEME_MODIFIERS` — every multiplier exactly 1
 * and every additive term exactly 0. Multiplying by 1 is exact in floating
 * point, so the engine applies these unconditionally without a single `if`, and
 * a league that has assigned no schemes gets the pre-A6 log byte-for-byte.
 *
 * That is not an accident of the numbers: each expression below is written so
 * that a zero tendency contributes a factor of exactly 1, never `1 - 0 * x`
 * inside a sum that could round.
 */

/**
 * What the matchup does to the offense's play, from the OFFENSE's point of
 * view. One struct per possession side, resolved at kickoff.
 */
export interface SchemeModifiers {
  /**
   * Added to the engine's baseline pass rate. Zero is neutral.
   *
   * Additive rather than multiplicative because the quantity is a probability
   * that must stay meaningful near both ends: scaling 0.52 by 1.4 and scaling
   * 0.62 by 1.4 should not produce the same offense, and one of them leaves the
   * unit interval.
   */
  passRateDelta: number;
  /** Scales the huddle/play-clock runoff between snaps. Below 1 is faster. */
  tempo: number;
  /** Scales the chance a play breaks for a big gain. */
  explosiveRate: number;
  /** Scales sack probability. */
  sackRate: number;
  /** Scales completion probability. */
  passAccuracy: number;
  /** Scales interception probability. */
  interceptionRate: number;
  /** Scales rushing yardage. */
  rushYards: number;
  /** Scales fumble probability. */
  fumbleRate: number;
}

export const NEUTRAL_SCHEME_MODIFIERS: Readonly<SchemeModifiers> =
  Object.freeze({
    passRateDelta: 0,
    tempo: 1,
    explosiveRate: 1,
    sackRate: 1,
    passAccuracy: 1,
    interceptionRate: 1,
    rushYards: 1,
    fumbleRate: 1,
  });

/**
 * A team's scheme assignment, as carried on `TeamSimProfile`.
 *
 * The dials are 0–100 with 50 neutral, matching every other rating in the app.
 * They OVERRIDE the scheme's own tendency on that axis rather than adding to
 * it in some third unit — a coach who dials blitzing to 90 is telling you what
 * they do on Friday night, whatever the base defense is called.
 */
export interface TeamSchemeProfile {
  offense?: string;
  defense?: string;
  /** 0–100, 50 neutral. Higher snaps it faster. */
  tempo?: number;
  /** 0–100, 50 neutral. Higher brings more pressure. */
  blitzRate?: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Fold a 0–100 dial into a −1…+1 tendency axis.
 *
 * An absent dial returns the base unchanged — that is the property the identity
 * contract rests on, so it must not be written as `base + (50 - 50) / 50`,
 * which is the same number but invites someone to "simplify" the guard away.
 */
function withDial(base: number, dial: number | undefined): number {
  if (typeof dial !== "number" || !Number.isFinite(dial)) return base;
  return clamp(base + (clamp(dial, 0, 100) - 50) / 50, -1, 1);
}

function resolveOffense(profile: TeamSchemeProfile | undefined): OffenseTendencies {
  const base = offenseTendencies(profile?.offense);
  const tempo = withDial(base.tempo, profile?.tempo);
  if (tempo === base.tempo) return base;
  return { ...base, tempo };
}

function resolveDefense(profile: TeamSchemeProfile | undefined): DefenseTendencies {
  const base = defenseTendencies(profile?.defense);
  const blitz = withDial(base.blitz, profile?.blitzRate);
  if (blitz === base.blitz) return base;
  return { ...base, blitz };
}

/**
 * How this offense, against this defense, plays.
 *
 * `offense` is the team with the ball and `defense` is the team without it, so
 * a game needs TWO of these — one per possession side. Only the offensive half
 * of `offense` and the defensive half of `defense` are read, which is why a
 * team can run an Air Raid and a 46 at the same time without the two
 * interfering.
 *
 * The interactions are the point. A blitz-heavy defense produces more sacks but
 * gives up more explosives; a quick-tempo offense beats the blitz; stacking the
 * box against a Flexbone makes them throw. Each of those is one term below and
 * each is arguable — which is the property that matters for tuning.
 */
export function schemeModifiers(
  offense: TeamSchemeProfile | undefined,
  defense: TeamSchemeProfile | undefined,
): SchemeModifiers {
  const off = resolveOffense(offense);
  const def = resolveDefense(defense);

  return {
    /*
     * You throw because you want to, and because they have loaded the box.
     * A light box (4-2-5 against a spread) is an invitation to run.
     */
    passRateDelta: off.passBias * 0.22 + def.runFit * 0.1,

    /* Tempo is the huddle, not the play. Faster scheme, less runoff. */
    tempo: clamp(1 - off.tempo * 0.24, 0.6, 1.4),

    /*
     * Deep shots break big; tight man coverage takes them away. Two
     * independent factors that multiply, so a vertical offense against a
     * lockdown secondary lands near neutral rather than at an extreme.
     */
    explosiveRate: clamp(
      (1 + off.vertical * 0.35) * (1 - def.coverage * 0.2),
      0.5,
      1.6,
    ),

    /*
     * Pressure gets home — unless the ball comes out fast. This is the term
     * that makes the 46 a gamble instead of a free upgrade.
     */
    sackRate: clamp((1 + def.blitz * 0.45) * (1 - off.tempo * 0.15), 0.5, 1.9),

    /* Man coverage contests throws; so does asking for a 40-yard shot. */
    passAccuracy: clamp(
      (1 - def.coverage * 0.1) * (1 - off.vertical * 0.08),
      0.8,
      1.15,
    ),

    /*
     * Both terms push the same way: tight coverage produces picks, and so does
     * throwing the ball down the field. Additive because they are alternative
     * causes of the same event, not compounding conditions on one.
     */
    interceptionRate: clamp(
      1 + def.coverage * 0.3 + off.vertical * 0.2,
      0.6,
      1.7,
    ),

    /*
     * A stacked box stops the run. A run-first offense blocks it better —
     * `-off.passBias` rewards the Flexbone and taxes the Air Raid's handoffs,
     * which is why a pass-happy team's rushing average is not just its backs.
     */
    rushYards: clamp((1 - def.runFit * 0.18) * (1 - off.passBias * 0.18), 0.7, 1.3),

    /* Option pitches and a loose grip. The one place ball security lives. */
    fumbleRate: clamp(1 - off.ballSecurity * 0.25, 0.7, 1.35),
  };
}

/** True when a scheme pairing leaves play untouched. */
export function isNeutralScheme(mods: SchemeModifiers): boolean {
  return (
    mods.passRateDelta === 0 &&
    mods.tempo === 1 &&
    mods.explosiveRate === 1 &&
    mods.sackRate === 1 &&
    mods.passAccuracy === 1 &&
    mods.interceptionRate === 1 &&
    mods.rushYards === 1 &&
    mods.fumbleRate === 1
  );
}

/** Layer a weekly gameplan on top of season scheme modifiers (C3). */
export function layerSchemeModifiers(
  base: SchemeModifiers,
  overlay: SchemeModifiers,
): SchemeModifiers {
  return {
    passRateDelta: base.passRateDelta + overlay.passRateDelta,
    tempo: base.tempo * overlay.tempo,
    explosiveRate: base.explosiveRate * overlay.explosiveRate,
    sackRate: base.sackRate * overlay.sackRate,
    passAccuracy: base.passAccuracy * overlay.passAccuracy,
    interceptionRate: base.interceptionRate * overlay.interceptionRate,
    rushYards: base.rushYards * overlay.rushYards,
    fumbleRate: base.fumbleRate * overlay.fumbleRate,
  };
}
