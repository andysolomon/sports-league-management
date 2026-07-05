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

export interface PbpGameInput {
  home: TeamSimProfile;
  away: TeamSimProfile;
  /** Same seed => byte-identical log. */
  seed: number;
  /** Playoff: overtime until no tie. */
  decisive?: boolean;
}

export type PbpPlayType =
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
  | "kneel";

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
}
