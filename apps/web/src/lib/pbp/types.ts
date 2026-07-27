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
  depthRank?: number;
}

export interface TeamSimProfile {
  teamId: string;
  strength: number;
  players: PlayerSimProfile[];
}

import type { SimulationFlavor } from "@/lib/simulation-flavor";

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
}
