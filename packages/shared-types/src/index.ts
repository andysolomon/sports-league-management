export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
  errorCode: string | null;
}

export interface LeagueDto {
  id: string;
  name: string;
  orgId: string | null;
}

export interface ConferenceDto {
  id: string;
  name: string;
  leagueId: string;
}

export interface DivisionDto {
  id: string;
  name: string;
  leagueId: string;
  /** Parent conference (WSM-000133), or null when the division is top-level. */
  conferenceId: string | null;
}

export interface TeamDto {
  id: string;
  name: string;
  leagueId: string;
  city: string;
  stadium: string;
  foundedYear: number | null;
  location: string;
  divisionId: string;
  logoUrl: string | null;
  rosterLimit: number | null;
  /** Team's own name/mascot, distinct from the school name in `name`. */
  teamName: string | null;
  /** Optional brand colors (hex, e.g. "#1e3a8a"). */
  primaryColor: string | null;
  secondaryColor: string | null;
  /**
   * Jersey policy (WSM-000125): when false, the server blocks duplicate jersey
   * numbers on the roster. When true (the default), duplicates are allowed and
   * only surfaced as an inline alert.
   */
  allowDuplicateJerseys: boolean;
  /** The team's MaxPreps Stat Supplier ID (coach-entered) for stat export. */
  maxprepsSupplierId: string | null;
}

/** High-school squad level. */
export type Squad = "Varsity" | "JV" | "Freshman";

export interface PlayerDto {
  id: string;
  name: string;
  teamId: string;
  position: string;
  positionGroup: string | null;
  jerseyNumber: number | null;
  dateOfBirth: string | null;
  status: string;
  headshotUrl: string | null;
  experienceYears: number | null;
  /** HS grade level, 9–12. */
  grade: number | null;
  /** HS squad: "Varsity" | "JV" | "Freshman" (stored as string for forward-compat). */
  squad: string | null;
}

export interface SeasonDto {
  id: string;
  name: string;
  leagueId: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  rosterLocked: boolean;
}

export interface DepthChartEntryDto {
  id: string;
  teamId: string;
  seasonId: string;
  playerId: string;
  positionSlot: string;
  sortOrder: number;
  updatedAt: string;
}

export interface RosterAssignmentDto {
  id: string;
  seasonId: string;
  teamId: string;
  playerId: string;
  leagueId: string;
  depthRank: number;
  positionSlot: string;
  status: string;
  assignedAt: string;
  assignedBy: string;
}

export type RosterAuditAction =
  | "assign"
  | "remove"
  | "status_change"
  | "depth_reorder";

export interface RosterAuditLogDto {
  id: string;
  leagueId: string;
  teamId: string;
  seasonId: string;
  actorUserId: string;
  action: RosterAuditAction;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
}

// --- Mutation input types ---

export interface CreatePlayerInput {
  name: string;
  teamId: string;
  position: string;
  jerseyNumber?: number | null;
  dateOfBirth?: string | null;
  status: string;
  grade?: number | null;
  squad?: Squad | null;
}

export interface UpdatePlayerInput {
  name?: string;
  teamId?: string;
  position?: string;
  jerseyNumber?: number | null;
  dateOfBirth?: string | null;
  status?: string;
  grade?: number | null;
  squad?: Squad | null;
}

export interface CreateLeagueInput {
  name: string;
}

export interface CreateDivisionInput {
  name: string;
  leagueId: string;
}

export interface CreateTeamInput {
  name: string;
  leagueId: string;
  city: string;
  stadium: string;
}

export interface UpdateTeamInput {
  name?: string;
  city?: string;
  stadium?: string;
  foundedYear?: number | null;
  location?: string;
  divisionId?: string;
  teamName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  allowDuplicateJerseys?: boolean;
  maxprepsSupplierId?: string | null;
}

// --- Import types ---

export interface ImportResultCounts {
  leagues: number;
  divisions: number;
  teams: number;
  players: number;
}

export interface ImportError {
  entity: string;
  name: string;
  message: string;
}

export interface ImportResult {
  leagueId: string;
  created: ImportResultCounts;
  updated: ImportResultCounts;
  errors: ImportError[];
}

// --- Sync types ---

export interface SyncReport {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  importResult: ImportResult | null;
  adapterErrors: string[];
}

export interface SyncConfig {
  syncEnabled: boolean;
  lastSyncReport: SyncReport | null;
}

// --- Player attributes (Phase 2, player_attributes_v1) ---

export interface PlayerAttributeDto {
  id: string;
  playerId: string;
  seasonId: string;
  positionGroup: string;
  /** Canonical attribute map (already normalized + weighted). */
  attributes: Record<string, number>;
  /** Raw PFF payload as ingested, null if not provided. */
  pffSource: Record<string, unknown> | null;
  /** Raw Madden payload as ingested, null if not provided. */
  maddenSource: Record<string, unknown> | null;
  pffWeight: number;
  maddenWeight: number;
  weightedOverall: number | null;
  ingestedAt: string;
}

// --- Schedules & standings (Phase 3, schedules_standings_v1) ---

export type FixtureStatus = "scheduled" | "final" | "cancelled";

export interface FixtureDto {
  id: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledAt: string | null;
  week: number | null;
  venue: string | null;
  status: FixtureStatus;
  createdAt: string;
  createdBy: string;
}

export interface GameResultDto {
  id: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  playerStatsJson: string | null;
  recordedAt: string;
  recordedBy: string;
}

// --- Stat-keeping keystone (WSM-000112) — football box-score stat model (§6) ---
// One player's game line, grouped. Only the groups relevant to a player's snaps
// need be present; within a group, fields default to 0 when absent. This is the
// "typed shape validated at the edge" stored as playerGameStats.statsJson.

export interface StatPassing {
  comp?: number;
  att?: number;
  yards?: number;
  td?: number;
  int?: number;
  sacked?: number;
}
export interface StatRushing {
  carries?: number;
  yards?: number;
  td?: number;
  long?: number;
}
export interface StatReceiving {
  rec?: number;
  yards?: number;
  td?: number;
  long?: number;
  targets?: number;
}
export interface StatDefense {
  tacklesSolo?: number;
  tacklesAst?: number;
  tfl?: number;
  sacks?: number;
  int?: number;
  passDef?: number;
  ff?: number;
  fr?: number;
  defTd?: number;
}
export interface StatKicking {
  fgMade?: number;
  fgAtt?: number;
  xpMade?: number;
  xpAtt?: number;
}
export interface StatPunting {
  punts?: number;
  yards?: number;
  long?: number;
}
export interface StatReturns {
  krCount?: number;
  krYards?: number;
  krTd?: number;
  prCount?: number;
  prYards?: number;
  prTd?: number;
}
export interface StatBallSecurity {
  fumbles?: number;
  fumblesLost?: number;
}

export interface PlayerGameStatLine {
  passing?: StatPassing;
  rushing?: StatRushing;
  receiving?: StatReceiving;
  defense?: StatDefense;
  kicking?: StatKicking;
  punting?: StatPunting;
  returns?: StatReturns;
  ballSecurity?: StatBallSecurity;
}

/** A player's entered stat line for one game (statsJson parsed into `stats`). */
export interface PlayerGameStatsDto {
  id: string;
  fixtureId: string;
  playerId: string;
  teamId: string;
  seasonId: string;
  stats: PlayerGameStatLine;
  enteredBy: string;
  updatedAt: string;
}

export interface Standing {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  divisionRank: number;
  leagueRank: number;
  /** Phase 4 per-player stat-rollup hook. */
  extended?: Record<string, number>;
}

// --- Subscription tier types ---

export type Tier = "free" | "plus" | "club" | "league";

export type BillingStatus = "active" | "past_due" | "canceled";

export interface UserSubscription {
  tier: Tier;
  billingStatus: BillingStatus;
  stripeCustomerId?: string;
  currentPeriodEnd?: string;
}
