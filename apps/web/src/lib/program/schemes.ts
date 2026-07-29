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

/*
 * ── Scheme fit (C3) ───────────────────────────────────────────────────────
 *
 * Advisory only — surfaced in the UI, never enforced on save. Fit compares a
 * roster's implied style to what a scheme wants, not whether the team is good.
 */

export interface SchemeFitPlayer {
  position?: string | null;
  /** 0–99; absent means this player does not contribute rated weight. */
  overall?: number | null;
  weightLbs?: number | null;
}

export interface SchemeFitRoster {
  players: readonly SchemeFitPlayer[];
}

const PASS_POSITIONS = new Set([
  "QB",
  "WR",
  "TE",
  "SLOT",
  "SE",
  "FL",
  "SL",
  "QB/WR",
]);
const RUN_POSITIONS = new Set([
  "RB",
  "HB",
  "FB",
  "TB",
  "ATH",
  "OL",
  "OT",
  "OG",
  "C",
  "G",
  "T",
]);

function positionGroup(position: string | null | undefined): "pass" | "run" | "other" {
  if (!position) return "other";
  const code = position.trim().toUpperCase().split("/")[0] ?? "";
  if (PASS_POSITIONS.has(code) || code.startsWith("WR")) return "pass";
  if (RUN_POSITIONS.has(code) || code.startsWith("RB") || code.startsWith("OL"))
    return "run";
  return "other";
}

function playerWeight(player: SchemeFitPlayer): number {
  if (typeof player.overall === "number" && Number.isFinite(player.overall)) {
    return Math.max(0.25, player.overall / 50);
  }
  return 1;
}

function rosterOffenseProfile(roster: SchemeFitRoster): OffenseTendencies {
  let passMass = 0;
  let runMass = 0;
  let heavyBacks = 0;
  let receivers = 0;

  for (const player of roster.players) {
    const w = playerWeight(player);
    const group = positionGroup(player.position);
    if (group === "pass") {
      passMass += w * 1.2;
      receivers += 1;
    } else if (group === "run") {
      runMass += w * 1.2;
      if (
        (typeof player.weightLbs === "number" && player.weightLbs >= 210) ||
        positionGroup(player.position) === "run"
      ) {
        heavyBacks += w;
      }
    } else {
      passMass += w * 0.2;
      runMass += w * 0.2;
    }
  }

  const total = passMass + runMass;
  if (total <= 0) return { ...NEUTRAL_OFFENSE_TENDENCIES };

  const passShare = passMass / total;
  const runShare = runMass / total;
  const sizeRunBias =
    heavyBacks > receivers
      ? clampTendency((heavyBacks - receivers) / Math.max(1, roster.players.length))
      : 0;

  return {
    passBias: clampTendency((passShare - runShare) * 1.4),
    tempo: clampTendency(receivers > heavyBacks ? 0.35 : heavyBacks > 0 ? -0.25 : 0),
    vertical: clampTendency(passShare > 0.62 ? 0.35 : 0),
    ballSecurity: clampTendency(runShare > 0.55 ? 0.15 : 0),
  };
}

function rosterDefenseProfile(roster: SchemeFitRoster): DefenseTendencies {
  let db = 0;
  let lb = 0;
  let dl = 0;
  for (const player of roster.players) {
    const w = playerWeight(player);
    const code = (player.position ?? "").trim().toUpperCase();
    if (code.startsWith("CB") || code.startsWith("S") || code === "DB") db += w;
    else if (code.startsWith("LB")) lb += w;
    else if (code.startsWith("DL") || code.startsWith("DE") || code.startsWith("DT"))
      dl += w;
  }
  const total = db + lb + dl;
  if (total <= 0) return { ...NEUTRAL_DEFENSE_TENDENCIES };
  const dbShare = db / total;
  const boxShare = (dl + lb) / total;
  return {
    blitz: clampTendency(lb / total - 0.33),
    coverage: clampTendency(dbShare - 0.33),
    runFit: clampTendency(boxShare - 0.45),
  };
}

function clampTendency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function tendencySimilarity(
  roster: OffenseTendencies | DefenseTendencies,
  scheme: OffenseTendencies | DefenseTendencies,
): number {
  const keys = Object.keys(roster) as Array<keyof typeof roster>;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const key of keys) {
    const a = roster[key];
    const b = scheme[key];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 && normB === 0) return 0.5;
  if (normA === 0 || normB === 0) return 0.5;
  const cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  if (!Number.isFinite(cosine)) return 0.5;
  return clamp01((cosine + 1) / 2);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

/**
 * How well a roster suits a scheme id (0 = poor, 1 = excellent).
 *
 * Total: empty rosters and rosters with no rated players still return a finite
 * value in [0, 1]. Unknown scheme ids use neutral tendencies.
 */
export function schemeFit(schemeId: string, roster: SchemeFitRoster): number {
  const players = roster?.players ?? [];
  const safeRoster: SchemeFitRoster = { players };

  if (isOffenseSchemeId(schemeId)) {
    const fit = tendencySimilarity(
      rosterOffenseProfile(safeRoster),
      OFFENSE_SCHEMES[schemeId].tendencies,
    );
    return clamp01(fit);
  }
  if (isDefenseSchemeId(schemeId)) {
    const fit = tendencySimilarity(
      rosterDefenseProfile(safeRoster),
      DEFENSE_SCHEMES[schemeId].tendencies,
    );
    return clamp01(fit);
  }
  return 0.5;
}
