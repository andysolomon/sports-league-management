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

export interface DivisionDto {
  id: string;
  name: string;
  leagueId: string;
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
}

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
}

export interface UpdatePlayerInput {
  name?: string;
  teamId?: string;
  position?: string;
  jerseyNumber?: number | null;
  dateOfBirth?: string | null;
  status?: string;
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
