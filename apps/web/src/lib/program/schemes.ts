/*
 * Scheme catalog (Dynasty Mode C3 / A6).
 *
 * Pure data. Every scheme is a vector of TENDENCIES, not a set of engine
 * numbers — this module has no idea what the simulator's baseline pass rate is,
 * and the simulator has no idea what a Flexbone is. `src/lib/pbp/schemes.ts`
 * translates one into the other, which is the same split `weather.ts` uses
 * between `Weather` and `WeatherModifiers`.
 *
 * ## Why the vectors are signed and centered on zero
 *
 * `balanced` is all zeros, and the translation layer maps an all-zero vector to
 * the exact identity transform. That is what makes the scheme-neutrality
 * invariant testable rather than approximate: a league that has assigned no
 * schemes gets a byte-identical log to the one it got before this slice.
 *
 * ## Note on ownership
 *
 * The roadmap gives this file to C3 (team schemes and weekly gameplanning) and
 * gives the translation to A6. A6 shipped first, so the catalog landed here
 * with only the fields A6 consumes. C3 extends it — gameplan sliders, per-week
 * emphasis — rather than creating it.
 */

export type OffenseSchemeId =
  | "balanced"
  | "air_raid"
  | "spread"
  | "pro_style"
  | "flexbone"
  | "wing_t";

export type DefenseSchemeId =
  | "balanced"
  | "four_three"
  | "three_four"
  | "four_two_five"
  | "forty_six";

/**
 * What an offense wants to do, on a −1…+1 axis each. Zero is "no preference",
 * which is not the same as "average of the catalog" — it means the scheme
 * expresses nothing and the engine's own baseline stands.
 */
export interface OffenseTendencies {
  /** −1 runs it every down, +1 throws it every down. */
  passBias: number;
  /** −1 huddles and grinds, +1 no-huddle. */
  tempo: number;
  /** −1 short and safe, +1 takes shots downfield. */
  vertical: number;
  /** −1 puts the ball on the ground, +1 protects it. */
  ballSecurity: number;
}

/** The same idea for a defense. */
export interface DefenseTendencies {
  /** −1 rushes four and drops, +1 brings pressure. */
  blitz: number;
  /** −1 soft zone, +1 tight man coverage. */
  coverage: number;
  /** −1 light box, +1 stacks the box against the run. */
  runFit: number;
}

export interface OffenseSchemeSpec {
  id: OffenseSchemeId;
  label: string;
  /** One line a commissioner can choose from without reading a manual. */
  blurb: string;
  tendencies: OffenseTendencies;
}

export interface DefenseSchemeSpec {
  id: DefenseSchemeId;
  label: string;
  blurb: string;
  tendencies: DefenseTendencies;
}

export const NEUTRAL_OFFENSE_TENDENCIES: Readonly<OffenseTendencies> =
  Object.freeze({ passBias: 0, tempo: 0, vertical: 0, ballSecurity: 0 });

export const NEUTRAL_DEFENSE_TENDENCIES: Readonly<DefenseTendencies> =
  Object.freeze({ blitz: 0, coverage: 0, runFit: 0 });

/*
 * The catalog.
 *
 * Values are deliberately not extreme. A scheme should be legible in a
 * season's box scores, not decide games on its own — a Flexbone team with a
 * bad roster still loses. The distribution test asserts the run/pass split
 * moves by a stated margin; it does not assert Flexbone wins.
 */
export const OFFENSE_SCHEMES: Readonly<
  Record<OffenseSchemeId, OffenseSchemeSpec>
> = Object.freeze({
  balanced: {
    id: "balanced",
    label: "Balanced",
    blurb: "No stated preference. The engine's own tendencies stand.",
    tendencies: { passBias: 0, tempo: 0, vertical: 0, ballSecurity: 0 },
  },
  air_raid: {
    id: "air_raid",
    label: "Air Raid",
    blurb: "Throws it everywhere, fast, and does not apologize for a pick.",
    tendencies: { passBias: 0.8, tempo: 0.7, vertical: 0.4, ballSecurity: -0.2 },
  },
  spread: {
    id: "spread",
    label: "Spread",
    blurb: "Tempo and space. Throws more than it runs, mostly underneath.",
    tendencies: { passBias: 0.45, tempo: 0.6, vertical: 0.2, ballSecurity: 0 },
  },
  pro_style: {
    id: "pro_style",
    label: "Pro Style",
    blurb: "Under center, play-action, takes care of the football.",
    tendencies: { passBias: 0.1, tempo: -0.2, vertical: 0.1, ballSecurity: 0.3 },
  },
  flexbone: {
    id: "flexbone",
    label: "Flexbone",
    blurb: "Triple option. Runs the ball and the clock; the pitch gets loose.",
    tendencies: {
      passBias: -0.8,
      tempo: -0.6,
      vertical: -0.3,
      ballSecurity: -0.1,
    },
  },
  wing_t: {
    id: "wing_t",
    label: "Wing-T",
    blurb: "Misdirection and downhill runs. Slow, deliberate, hard to tackle.",
    tendencies: {
      passBias: -0.6,
      tempo: -0.5,
      vertical: -0.2,
      ballSecurity: 0.2,
    },
  },
});

export const DEFENSE_SCHEMES: Readonly<
  Record<DefenseSchemeId, DefenseSchemeSpec>
> = Object.freeze({
  balanced: {
    id: "balanced",
    label: "Balanced",
    blurb: "No stated preference. The engine's own tendencies stand.",
    tendencies: { blitz: 0, coverage: 0, runFit: 0 },
  },
  four_three: {
    id: "four_three",
    label: "4-3",
    blurb: "Four down linemen. Sound against the run, rushes four.",
    tendencies: { blitz: -0.1, coverage: 0, runFit: 0.3 },
  },
  three_four: {
    id: "three_four",
    label: "3-4",
    blurb: "Three down, four linebackers. Pressure from anywhere.",
    tendencies: { blitz: 0.3, coverage: -0.1, runFit: 0.1 },
  },
  four_two_five: {
    id: "four_two_five",
    label: "4-2-5",
    blurb: "Five defensive backs. Built for spread offenses, light in the box.",
    tendencies: { blitz: 0, coverage: 0.4, runFit: -0.35 },
  },
  forty_six: {
    id: "forty_six",
    label: "46",
    blurb: "Crowds the line and brings everyone. Feast or famine.",
    tendencies: { blitz: 0.8, coverage: 0.2, runFit: 0.5 },
  },
});

export const DEFAULT_OFFENSE_SCHEME: OffenseSchemeId = "balanced";
export const DEFAULT_DEFENSE_SCHEME: DefenseSchemeId = "balanced";

export function isOffenseSchemeId(value: string): value is OffenseSchemeId {
  return value in OFFENSE_SCHEMES;
}

export function isDefenseSchemeId(value: string): value is DefenseSchemeId {
  return value in DEFENSE_SCHEMES;
}

/**
 * Tendencies for a scheme id.
 *
 * Total: an absent, empty or unrecognized id yields the neutral vector rather
 * than throwing. A misspelled scheme in the database must degrade to "no
 * scheme", not break a season simulation — the same fail-soft rule
 * `resolveDynastyConfig` follows.
 */
export function offenseTendencies(
  id: string | null | undefined,
): OffenseTendencies {
  if (typeof id === "string" && isOffenseSchemeId(id)) {
    return OFFENSE_SCHEMES[id].tendencies;
  }
  return NEUTRAL_OFFENSE_TENDENCIES;
}

export function defenseTendencies(
  id: string | null | undefined,
): DefenseTendencies {
  if (typeof id === "string" && isDefenseSchemeId(id)) {
    return DEFENSE_SCHEMES[id].tendencies;
  }
  return NEUTRAL_DEFENSE_TENDENCIES;
}

export const OFFENSE_SCHEME_LIST: readonly OffenseSchemeSpec[] = Object.freeze(
  Object.values(OFFENSE_SCHEMES),
);

export const DEFENSE_SCHEME_LIST: readonly DefenseSchemeSpec[] = Object.freeze(
  Object.values(DEFENSE_SCHEMES),
);
