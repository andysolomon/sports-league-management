import type {
  CreateDivisionInput,
  CreateLeagueInput,
  CreatePlayerInput,
  CreateTeamInput,
  DivisionDto,
  LeagueDto,
  PlayerDto,
  TeamDto,
  UpdatePlayerInput,
  UpdateTeamInput,
} from "@sports-management/shared-types";

/** Division fields editable after creation (no server-side equivalent input type). */
export interface UpdateDivisionInput {
  name?: string;
  conferenceId?: string | null;
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
