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
// The SAME pure standings function the Convex server uses — shared so local and
// synced standings can never drift (RFC §11). It is dependency-free TS.
import { computeStandingsPure } from "../../../convex/lib/standings";
import { getLocalDb, WsmLocalDb } from "./local-db";
import {
  type CreateFixtureInput,
  type CreateSeasonInput,
  DuplicateJerseyError,
  type UpdateDivisionInput,
  type UpdateFixtureInput,
  type UpdateSeasonInput,
  type WorkspaceDataProvider,
} from "./workspace-provider";

/** Current ISO timestamp for created/recorded audit fields. */
function nowIso(): string {
  return new Date().toISOString();
}

/** A team's default roster cap, matching the server's createTeam (53). */
const DEFAULT_ROSTER_LIMIT = 53;

function newId(): string {
  return crypto.randomUUID();
}

/**
 * IndexedDB-backed implementation of the workspace contract (WSM-000137 RFC §5),
 * for the free no-login tier. Everything lives in the browser; ids are generated
 * client-side. Defaults and the jersey-duplicate policy mirror the server
 * mutations (createTeam/createPlayer, WSM-000125) so local and synced workspaces
 * behave identically and a local workspace migrates cleanly (RFC §8).
 *
 * Slice 1 scope: leagues, divisions, teams, players.
 */
export class LocalWorkspaceProvider implements WorkspaceDataProvider {
  constructor(private readonly db: WsmLocalDb = getLocalDb()) {}

  // --- Leagues ---

  async createLeague(input: CreateLeagueInput): Promise<LeagueDto> {
    // Local workspaces have no org — orgId is always null.
    const league: LeagueDto = { id: newId(), name: input.name, orgId: null };
    await this.db.leagues.add(league);
    return league;
  }

  async getLeague(id: string): Promise<LeagueDto | null> {
    return (await this.db.leagues.get(id)) ?? null;
  }

  async listLeagues(): Promise<LeagueDto[]> {
    return this.db.leagues.toArray();
  }

  // --- Divisions ---

  async createDivision(input: CreateDivisionInput): Promise<DivisionDto> {
    const division: DivisionDto = {
      id: newId(),
      name: input.name,
      leagueId: input.leagueId,
      conferenceId: null,
    };
    await this.db.divisions.add(division);
    return division;
  }

  async listDivisions(leagueId: string): Promise<DivisionDto[]> {
    return this.db.divisions.where("leagueId").equals(leagueId).toArray();
  }

  async updateDivision(
    id: string,
    input: UpdateDivisionInput,
  ): Promise<DivisionDto | null> {
    const existing = await this.db.divisions.get(id);
    if (!existing) return null;
    const updated: DivisionDto = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.conferenceId !== undefined
        ? { conferenceId: input.conferenceId }
        : {}),
    };
    await this.db.divisions.put(updated);
    return updated;
  }

  async deleteDivision(id: string): Promise<void> {
    await this.db.divisions.delete(id);
  }

  // --- Teams ---

  async createTeam(input: CreateTeamInput): Promise<TeamDto> {
    // Defaults mirror the server's createTeam: no division yet (""), location
    // seeded from city, roster limit 53, duplicate jerseys allowed.
    const team: TeamDto = {
      id: newId(),
      name: input.name,
      leagueId: input.leagueId,
      city: input.city,
      stadium: input.stadium,
      foundedYear: null,
      location: input.city,
      divisionId: "",
      logoUrl: null,
      rosterLimit: DEFAULT_ROSTER_LIMIT,
      teamName: null,
      primaryColor: null,
      secondaryColor: null,
      allowDuplicateJerseys: true,
    };
    await this.db.teams.add(team);
    return team;
  }

  async getTeam(id: string): Promise<TeamDto | null> {
    return (await this.db.teams.get(id)) ?? null;
  }

  async listTeams(leagueId?: string): Promise<TeamDto[]> {
    if (leagueId === undefined) return this.db.teams.toArray();
    return this.db.teams.where("leagueId").equals(leagueId).toArray();
  }

  async updateTeam(
    id: string,
    input: UpdateTeamInput,
  ): Promise<TeamDto | null> {
    const existing = await this.db.teams.get(id);
    if (!existing) return null;
    const updated: TeamDto = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.stadium !== undefined ? { stadium: input.stadium } : {}),
      ...(input.foundedYear !== undefined
        ? { foundedYear: input.foundedYear }
        : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.divisionId !== undefined
        ? { divisionId: input.divisionId }
        : {}),
      ...(input.teamName !== undefined ? { teamName: input.teamName } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.primaryColor !== undefined
        ? { primaryColor: input.primaryColor }
        : {}),
      ...(input.secondaryColor !== undefined
        ? { secondaryColor: input.secondaryColor }
        : {}),
      ...(input.allowDuplicateJerseys !== undefined
        ? { allowDuplicateJerseys: input.allowDuplicateJerseys }
        : {}),
    };
    await this.db.teams.put(updated);
    return updated;
  }

  async deleteTeam(id: string): Promise<void> {
    // Cascade to the roster, mirroring the server's purgeTeam.
    await this.db.transaction("rw", this.db.teams, this.db.players, async () => {
      await this.db.players.where("teamId").equals(id).delete();
      await this.db.teams.delete(id);
    });
  }

  // --- Players ---

  async createPlayer(input: CreatePlayerInput): Promise<PlayerDto> {
    const team = await this.db.teams.get(input.teamId);
    if (!team) throw new Error("Team not found");

    await this.assertJerseyAllowed(
      team.id,
      team.allowDuplicateJerseys,
      input.jerseyNumber ?? null,
    );

    const player: PlayerDto = {
      id: newId(),
      name: input.name,
      teamId: input.teamId,
      position: input.position,
      positionGroup: null,
      jerseyNumber: input.jerseyNumber ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      status: input.status,
      headshotUrl: null,
      experienceYears: null,
    };
    await this.db.players.add(player);
    return player;
  }

  async getPlayer(id: string): Promise<PlayerDto | null> {
    return (await this.db.players.get(id)) ?? null;
  }

  async listPlayersByTeam(teamId: string): Promise<PlayerDto[]> {
    return this.db.players.where("teamId").equals(teamId).toArray();
  }

  async updatePlayer(
    id: string,
    input: UpdatePlayerInput,
  ): Promise<PlayerDto | null> {
    const existing = await this.db.players.get(id);
    if (!existing) return null;

    const updated: PlayerDto = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.jerseyNumber !== undefined
        ? { jerseyNumber: input.jerseyNumber }
        : {}),
      ...(input.dateOfBirth !== undefined
        ? { dateOfBirth: input.dateOfBirth }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };

    const team = await this.db.teams.get(updated.teamId);
    if (team) {
      await this.assertJerseyAllowed(
        team.id,
        team.allowDuplicateJerseys,
        updated.jerseyNumber,
        id,
      );
    }

    await this.db.players.put(updated);
    return updated;
  }

  async deletePlayer(id: string): Promise<void> {
    await this.db.players.delete(id);
  }

  // --- Seasons ---

  async createSeason(input: CreateSeasonInput): Promise<SeasonDto> {
    const season: SeasonDto = {
      id: newId(),
      name: input.name,
      leagueId: input.leagueId,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: "active",
      rosterLocked: false,
    };
    await this.db.seasons.add(season);
    return season;
  }

  async listSeasons(leagueId: string): Promise<SeasonDto[]> {
    return this.db.seasons.where("leagueId").equals(leagueId).toArray();
  }

  async updateSeason(
    id: string,
    input: UpdateSeasonInput,
  ): Promise<SeasonDto | null> {
    const existing = await this.db.seasons.get(id);
    if (!existing) return null;
    const updated: SeasonDto = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
    await this.db.seasons.put(updated);
    return updated;
  }

  async deleteSeason(id: string): Promise<void> {
    // Cascade to fixtures and their results.
    await this.db.transaction(
      "rw",
      this.db.seasons,
      this.db.fixtures,
      this.db.gameResults,
      async () => {
        const fixtures = await this.db.fixtures
          .where("seasonId")
          .equals(id)
          .toArray();
        for (const f of fixtures) {
          await this.db.gameResults.where("fixtureId").equals(f.id).delete();
        }
        await this.db.fixtures.where("seasonId").equals(id).delete();
        await this.db.seasons.delete(id);
      },
    );
  }

  // --- Schedule (fixtures + results) ---

  async createFixture(input: CreateFixtureInput): Promise<FixtureDto> {
    // Denormalize team names into the fixture, as the server does.
    const [home, away] = await Promise.all([
      this.db.teams.get(input.homeTeamId),
      this.db.teams.get(input.awayTeamId),
    ]);
    if (!home || !away) throw new Error("Home or away team not found");

    const fixture: FixtureDto = {
      id: newId(),
      seasonId: input.seasonId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      homeTeamName: home.name,
      awayTeamName: away.name,
      scheduledAt: input.scheduledAt ?? null,
      week: input.week ?? null,
      venue: input.venue ?? null,
      status: "scheduled",
      createdAt: nowIso(),
      createdBy: "local",
    };
    await this.db.fixtures.add(fixture);
    return fixture;
  }

  async listFixturesBySeason(seasonId: string): Promise<FixtureDto[]> {
    return this.db.fixtures.where("seasonId").equals(seasonId).toArray();
  }

  async updateFixture(
    id: string,
    input: UpdateFixtureInput,
  ): Promise<FixtureDto | null> {
    const existing = await this.db.fixtures.get(id);
    if (!existing) return null;
    const updated: FixtureDto = {
      ...existing,
      ...(input.scheduledAt !== undefined
        ? { scheduledAt: input.scheduledAt }
        : {}),
      ...(input.week !== undefined ? { week: input.week } : {}),
      ...(input.venue !== undefined ? { venue: input.venue } : {}),
      ...(input.status !== undefined
        ? { status: input.status as FixtureDto["status"] }
        : {}),
    };
    await this.db.fixtures.put(updated);
    return updated;
  }

  async deleteFixture(id: string): Promise<void> {
    await this.db.transaction(
      "rw",
      this.db.fixtures,
      this.db.gameResults,
      async () => {
        await this.db.gameResults.where("fixtureId").equals(id).delete();
        await this.db.fixtures.delete(id);
      },
    );
  }

  async recordGameResult(
    fixtureId: string,
    homeScore: number,
    awayScore: number,
  ): Promise<GameResultDto> {
    const fixture = await this.db.fixtures.get(fixtureId);
    if (!fixture) throw new Error("Fixture not found");

    // One result per fixture: overwrite any existing one.
    const existing = (
      await this.db.gameResults.where("fixtureId").equals(fixtureId).toArray()
    )[0];
    const result: GameResultDto = {
      id: existing?.id ?? newId(),
      fixtureId,
      homeScore,
      awayScore,
      playerStatsJson: null,
      recordedAt: nowIso(),
      recordedBy: "local",
    };

    await this.db.transaction(
      "rw",
      this.db.fixtures,
      this.db.gameResults,
      async () => {
        await this.db.gameResults.put(result);
        // Recording a score finalizes the fixture so it counts in standings.
        await this.db.fixtures.put({ ...fixture, status: "final" });
      },
    );
    return result;
  }

  async getResultByFixture(fixtureId: string): Promise<GameResultDto | null> {
    const rows = await this.db.gameResults
      .where("fixtureId")
      .equals(fixtureId)
      .toArray();
    return rows[0] ?? null;
  }

  // --- Standings ---

  async computeStandings(seasonId: string): Promise<Standing[]> {
    const season = await this.db.seasons.get(seasonId);
    if (!season) return [];

    const [teams, fixtures] = await Promise.all([
      this.db.teams.where("leagueId").equals(season.leagueId).toArray(),
      this.db.fixtures.where("seasonId").equals(seasonId).toArray(),
    ]);
    const results = (
      await Promise.all(
        fixtures.map((f) =>
          this.db.gameResults.where("fixtureId").equals(f.id).toArray(),
        ),
      )
    ).flat();

    // Adapt local DTOs to the pure function's `*Like` shapes (id → _id; a team
    // with no division uses null so it isn't grouped with other division-less
    // teams as a real division).
    return computeStandingsPure({
      teams: teams.map((t) => ({
        _id: t.id,
        name: t.name,
        divisionId: t.divisionId === "" ? null : t.divisionId,
      })),
      fixtures: fixtures.map((f) => ({
        _id: f.id,
        seasonId: f.seasonId,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        status: f.status,
      })),
      results: results.map((r) => ({
        fixtureId: r.fixtureId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
      })),
    });
  }

  /**
   * Enforce the jersey-duplicate policy (WSM-000125), matching the server's
   * `jerseyNumberTakenOnTeam`: when the team disallows duplicates, a non-null
   * number already worn by another ACTIVE player on the team is rejected. The
   * check keys off existing active wearers and is independent of the incoming
   * player's own status. `excludePlayerId` skips the player being edited.
   */
  private async assertJerseyAllowed(
    teamId: string,
    allowDuplicateJerseys: boolean,
    jerseyNumber: number | null,
    excludePlayerId?: string,
  ): Promise<void> {
    if (allowDuplicateJerseys) return;
    if (jerseyNumber === null) return;

    const roster = await this.db.players
      .where("teamId")
      .equals(teamId)
      .toArray();
    const taken = roster.some(
      (p) =>
        p.id !== excludePlayerId &&
        p.jerseyNumber === jerseyNumber &&
        p.status.toLowerCase() === "active",
    );
    if (taken) throw new DuplicateJerseyError(jerseyNumber);
  }
}
