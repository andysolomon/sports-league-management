/** Position groups used for participant selection (mirrors convex positionToRatingGroup + K/P). */
export type SimPositionGroup =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "DL"
  | "LB"
  | "DB"
  | "K"
  | "P";

export interface PlayerSimProfile {
  playerId: string;
  /** Raw position code (QB, RB/HB/FB, WR, TE, OL, DL/DT/DE, LB/ILB/OLB, CB/S/FS/SS, K, P). */
  position: string;
  /** Resolved rating 0–99 (weightedOverall or Madden fallback). */
  overall: number;
  /** From depthChartEntries/rosterAssignments when available. */
  positionSlot?: string;
  /**
   * Endurance rating, when the player has an attribute snapshot (A4). Absent
   * means average — never zero, which would gas an unrated player instantly.
   */
  endurance?: number;
  depthRank?: number;
  /**
   * Awareness (AWR) 0-99, when the player has an attribute snapshot. Drives
   * penalty discipline (A2); absent falls back to `overall`.
   */
  awareness?: number;
}

export interface TeamSimProfile {
  teamId: string;
  strength: number;
  players: PlayerSimProfile[];
  /**
   * Mean roster awareness 0-99 (A2). Lower means more flags. Absent falls back
   * to `strength`, so a team with no attribute snapshots still simulates.
   */
  discipline?: number;
  /**
   * Coaching tendencies (A3). Absent means a neutral coach, which is why this
   * slice does not depend on Epic C — the `coaches` table simply fills these in
   * later. Do NOT default these to a team's strength: a bad team with a bold
   * coach is a real thing and the model should be able to express it.
   */
  coach?: {
    /** 0-100; 50 neutral. Drives 4th-down and two-point boldness. */
    aggression?: number;
  };
}

import type { SimulationFlavor } from "@/lib/simulation-flavor";
import type { Weather } from "./weather";

export interface PbpGameInput {
  home: TeamSimProfile;
  away: TeamSimProfile;
  /** Same seed => byte-identical log. */
  seed: number;
  /** Playoff: overtime until no tie. */
  decisive?: boolean;
  /** Season simulation flavor; `balanced` preserves legacy weighting. */
  flavor?: SimulationFlavor;
  /**
   * v2 mechanics to enable. Omitted or all-false reproduces the v1 engine
   * byte-for-byte for the same seed — see `PbpFeatureGates`.
   */
  features?: PbpFeatureGates;
  /**
   * Conditions this game is played in (A5), derived by the caller from season,
   * week and venue. The engine does not compute it, because the engine does not
   * know what week it is.
   *
   * Read only under `features.weather`. Passing it with the gate off changes
   * nothing — which is what lets a caller derive conditions for display without
   * committing to simulating under them.
   */
  weather?: Weather;
  /**
   * Crowd context (A5). Both fields optional and neutral by default, so a
   * league that has declared no rivalries and has no program data behaves
   * exactly as it did before this slice.
   */
  venuePrestige?: number;
  rivalryIntensity?: number;
  /**
   * League injury dial (A4), 0–2. Read only under `features.injuries`.
   * Defaults to 1 (normal) when the gate is on and this is absent — a caller
   * that enabled injuries wants them at the usual rate.
   */
  injurySeverityScale?: number;
}

/** An injury sustained during a simulated game (A4). */
export interface GameInjury {
  playerId: string;
  teamId: string;
  severity: string;
  gamesOut: number;
  label: string;
  quarter: number;
}

export type PbpPlayType =
  // ── v1 (engine 1.0.0) ──────────────────────────────────────────────────
  | "kickoff"
  | "rush"
  | "pass_complete"
  | "pass_incomplete"
  | "sack"
  | "interception"
  | "punt"
  | "field_goal"
  | "field_goal_miss"
  | "extra_point"
  | "extra_point_miss"
  | "kneel"
  /*
   * ── v2 (engine 2.0.0, Epic A) ─────────────────────────────────────────
   *
   * Additive only. A stored v1 log contains none of these, which is exactly
   * why every consumer must widen rather than assume: `normalizeGameLog` in
   * `migrate-log.ts` up-converts old logs on read, and stored rows are never
   * rewritten.
   */
  | "two_point_convert"
  | "two_point_fail"
  | "safety"
  | "onside_kick"
  // A2 (penalties) and A3 (clock management) emit these; the type is declared
  // in A1 so the log format has a single version bump rather than three.
  | "penalty"
  | "spike"
  | "timeout";

export type PbpParticipantRole =
  | "kicker"
  | "returner"
  | "passer"
  | "rusher"
  | "receiver"
  | "tackler_solo"
  | "tackler_ast"
  | "sacker"
  | "interceptor"
  | "pass_defender"
  | "fumbler"
  | "recoverer";

export interface PbpParticipant {
  playerId: string;
  teamId: string;
  role: PbpParticipantRole;
}

export type PbpDriveEndReason =
  | "touchdown"
  | "field_goal"
  | "punt"
  | "turnover"
  | "end_of_half"
  | "end_of_game"
  | "downs"
  | "missed_field_goal";

export interface PbpPlay {
  playId: number;
  driveId: number;
  quarter: number;
  /** Seconds remaining in the quarter (monotonic decreasing within quarter). */
  clockSeconds: number;
  offenseTeamId: string;
  defenseTeamId: string;
  playType: PbpPlayType;
  down: number;
  distance: number;
  /** Yards from offense own goal line (0–100). */
  fieldPosition: number;
  yardsGained: number;
  isScoring: boolean;
  pointsScored: number;
  isTurnover: boolean;
  participants: PbpParticipant[];

  /*
   * ── v2 additions (engine 2.0.0) ───────────────────────────────────────
   *
   * ALL optional. A v1 log has none of them, and `normalizeGameLog` does not
   * invent values — absent means "this engine did not model it", which is
   * different from zero. Readers must treat `undefined` as unknown.
   */

  /** Yards gained on a kickoff, punt, interception or fumble return. */
  returnYards?: number;
  /** The return itself reached the end zone (A1). */
  isReturnTd?: boolean;
  /** Points scored by the DEFENSE on this play — a safety, or a return TD. */
  defensivePoints?: number;

  /**
   * Someone was hurt on this play (A4).
   *
   * Absent means nobody was — which, on a log whose `features.injuries` is
   * unset, is indistinguishable from "this engine did not model injuries". The
   * recorded gate is what tells those apart.
   */
  injury?: {
    playerId: string;
    teamId: string;
    severity: string;
    gamesOut: number;
    label: string;
  };

  /**
   * The flag on this play (A2), if any.
   *
   * A play carrying `negatesPlay: true` is KEPT in the log — you want to see
   * the run that holding wiped out — but `deriveStatLines` skips it, so no
   * player is credited for a play that officially did not happen.
   */
  penalty?: {
    code: string;
    label: string;
    yards: number;
    onOffense: boolean;
    accepted: boolean;
    negatesPlay: boolean;
    reason: string;
  };

  /**
   * How the offense was treating the clock on this play (A3).
   *
   * Present only under the `situational` gate, and only when the tempo was not
   * `normal` — so its absence means either "v1 log" or "nothing notable", which
   * is fine here because tempo has no stat consequences. Anything a reader must
   * distinguish absence from zero for gets its own honest-absence treatment
   * (see `returnYards`).
   */
  tempo?: "hurry_up" | "burn";

  /**
   * Which team called this timeout (A3), for `playType === "timeout"` only.
   *
   * Needed because either side can call one: `offenseTeamId` identifies who has
   * the ball, not who spent the timeout, and a defensive timeout late in a game
   * is exactly the interesting case.
   */
  timeoutTeamId?: string;
}

export interface PbpDrive {
  driveId: number;
  teamId: string;
  startQuarter: number;
  startClockSeconds: number;
  startFieldPosition: number;
  endReason: PbpDriveEndReason;
  plays: PbpPlay[];
}

export interface PbpGameLog {
  seed: number;
  decisive: boolean;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  drives: PbpDrive[];

  /**
   * Conditions the game was actually played in (A5).
   *
   * Written only when the `weather` gate was on. Its ABSENCE means the game was
   * not simulated under modelled conditions — which is not the same as fair
   * weather, and a reader must not substitute the derived forecast for it. The
   * forecast is what the schedule shows for a game nobody has played; this is
   * what history reads.
   */
  weather?: Weather;

  /**
   * The gates this game was ACTUALLY simulated under.
   *
   * The engine version alone cannot answer "were penalties modelled here?" —
   * two games written by the same engine build differ if a commissioner turned
   * penalties off between them, and a league that adopts a mechanic mid-season
   * has both kinds of log in one season (#646).
   *
   * Absence means no v2 mechanic was active, which is what keeps a fully-gated-
   * off game byte-identical to its v1 log. Written only when at least one gate
   * is on; never defaulted to `{}`.
   */
  features?: PbpFeatureGates;

  /**
   * Everyone hurt in this game (A4), in the order it happened.
   *
   * Absent when the gate was off. An EMPTY array is different and meaningful:
   * injuries were modelled and nobody got hurt.
   */
  injuries?: GameInjury[];

  /*
   * ── v2 additions (engine 2.0.0) ───────────────────────────────────────
   *
   * `version` is absent on every v1 log, which is how `normalizeGameLog`
   * recognizes one. Do not default it at write time — its absence is the
   * signal.
   */
  version?: 2;
}

/*
 * Engine feature gates (Epic A).
 *
 * Every v2 mechanic is opt-in and, when disabled, must consume ZERO random
 * draws. The PRNG is a sequence: a disabled feature that calls `rand()` even
 * once shifts every subsequent draw and the whole log diverges from v1. That
 * is what makes byte-for-byte golden parity testable at all, so treat "no
 * draws when off" as a hard rule, not an optimization.
 */
export interface PbpFeatureGates {
  /**
   * A1 — safeties, two-point conversions, return touchdowns, and fumbles on
   * plays other than a rush.
   */
  scoringV2?: boolean;
  /** A2 — penalties, with accept/decline. */
  penalties?: boolean;
  /**
   * A4 — fatigue, durability and injuries.
   *
   * One gate for both halves on purpose: fatigue with no injury risk is a
   * rating tweak nobody would notice, and injuries with no fatigue lose the
   * link that makes riding a starter cost something.
   */
  injuries?: boolean;
  /**
   * A5 — weather, venue prestige and rivalry.
   *
   * Maps to `dynastyConfig.weatherEnabled` once the gates are wired. With it
   * off the engine ignores `PbpGameInput.weather` entirely and consumes no
   * extra draws, so the pre-A5 log reproduces byte-for-byte.
   */
  weather?: boolean;
  /**
   * A3 — situational decisions and clock management: a 4th-down chart in place
   * of a coin flip, timeouts, the two-minute drill, spikes and onside kicks.
   *
   * Also carries the realistic clock model. v1 charged a full ~30-second cycle
   * to every snap including incompletions, which capped a game at roughly 96
   * scrimmage plays and is the main reason scoring sat below the design band.
   */
  situational?: boolean;
  /**
   * A3 — the balance recalibration filed as #642.
   *
   * Separate from `situational` on purpose. That gate adds *mechanics*; this
   * one only retunes constants that were already there. Keeping them apart
   * means a league can adopt clock management without adopting the new
   * home-field weighting, and it means the distribution report can attribute
   * each change independently.
   */
  balance?: boolean;
}
