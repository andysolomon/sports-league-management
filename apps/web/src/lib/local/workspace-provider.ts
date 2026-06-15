import type {
  CreateDivisionInput,
  CreateLeagueInput,
  CreatePlayerInput,
  CreateTeamInput,
  DivisionDto,
  FixtureDto,
  GameResultDto,
  LeagueDto,
  PlayerDto,
  SeasonDto,
  Standing,
  TeamDto,
  UpdatePlayerInput,
  UpdateTeamInput,
} from "@sports-management/shared-types";

/** Division fields editable after creation (no server-side equivalent input type). */
export interface UpdateDivisionInput {
  name?: string;
  conferenceId?: string | null;
}

/** Season create fields (mirrors the server's upsertSeason inputs). */
export interface CreateSeasonInput {
  name: string;
  leagueId: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateSeasonInput {
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
}

/** Fixture create fields (mirrors the server's createFixture, minus actorUserId). */
export interface CreateFixtureInput {
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt?: string | null;
  week?: number | null;
  venue?: string | null;
}

export interface UpdateFixtureInput {
  scheduledAt?: string | null;
  week?: number | null;
  venue?: string | null;
  status?: string;
}

/**
 * Transport-agnostic workspace data contract (WSM-000137 RFC §5).
 *
 * The local IndexedDB provider and the existing server (Convex) path both aim to
 * satisfy this single interface, so `/local` pages and `/dashboard` pages can
 * share presentational components and differ only in which provider they load.
 *
 * This is the **local-capable subset** (RFC §3): leagues, divisions, teams,
 * players. Account-only operations (orgs, members, public viewer, Discover
 * forks) are deliberately ABSENT — a provider that can't do them simply doesn't
 * expose them, which is how the boundary is enforced in types rather than at
 * runtime. Seasons, schedule, and standings join the contract in later slices.
 */
export interface WorkspaceDataProvider {
  // --- Leagues ---
  createLeague(input: CreateLeagueInput): Promise<LeagueDto>;
  getLeague(id: string): Promise<LeagueDto | null>;
  listLeagues(): Promise<LeagueDto[]>;

  // --- Divisions ---
  createDivision(input: CreateDivisionInput): Promise<DivisionDto>;
  listDivisions(leagueId: string): Promise<DivisionDto[]>;
  updateDivision(
    id: string,
    input: UpdateDivisionInput,
  ): Promise<DivisionDto | null>;
  deleteDivision(id: string): Promise<void>;

  // --- Teams ---
  createTeam(input: CreateTeamInput): Promise<TeamDto>;
  getTeam(id: string): Promise<TeamDto | null>;
  /** All teams, or only those in `leagueId` when provided. */
  listTeams(leagueId?: string): Promise<TeamDto[]>;
  updateTeam(id: string, input: UpdateTeamInput): Promise<TeamDto | null>;
  /** Deletes the team and cascades to its players (mirrors server purgeTeam). */
  deleteTeam(id: string): Promise<void>;

  // --- Players ---
  createPlayer(input: CreatePlayerInput): Promise<PlayerDto>;
  getPlayer(id: string): Promise<PlayerDto | null>;
  listPlayersByTeam(teamId: string): Promise<PlayerDto[]>;
  updatePlayer(
    id: string,
    input: UpdatePlayerInput,
  ): Promise<PlayerDto | null>;
  deletePlayer(id: string): Promise<void>;

  // --- Seasons ---
  createSeason(input: CreateSeasonInput): Promise<SeasonDto>;
  listSeasons(leagueId: string): Promise<SeasonDto[]>;
  updateSeason(id: string, input: UpdateSeasonInput): Promise<SeasonDto | null>;
  /** Deletes the season and cascades to its fixtures and their results. */
  deleteSeason(id: string): Promise<void>;

  // --- Schedule (fixtures + results) ---
  createFixture(input: CreateFixtureInput): Promise<FixtureDto>;
  listFixturesBySeason(seasonId: string): Promise<FixtureDto[]>;
  updateFixture(
    id: string,
    input: UpdateFixtureInput,
  ): Promise<FixtureDto | null>;
  /** Deletes the fixture and its result, if any. */
  deleteFixture(id: string): Promise<void>;
  /**
   * Record (or overwrite) a fixture's score. Marks the fixture `final` so it
   * counts toward standings — mirrors the server's recordGameResult.
   */
  recordGameResult(
    fixtureId: string,
    homeScore: number,
    awayScore: number,
  ): Promise<GameResultDto>;
  getResultByFixture(fixtureId: string): Promise<GameResultDto | null>;

  // --- Standings ---
  /**
   * League standings for a season, computed with the SAME pure function the
   * server uses (`computeStandingsPure`) so local and synced standings never
   * diverge (RFC §11).
   */
  computeStandings(seasonId: string): Promise<Standing[]>;
}

/**
 * Thrown when a jersey number is already worn by an active player on a team whose
 * `allowDuplicateJerseys` policy is false — mirrors the server's
 * `duplicate_jersey:<n>` error (WSM-000125) so callers can handle both paths the
 * same way.
 */
export class DuplicateJerseyError extends Error {
  constructor(public readonly jerseyNumber: number) {
    super(`duplicate_jersey:${jerseyNumber}`);
    this.name = "DuplicateJerseyError";
  }
}
