import { getLocalDb, type WsmLocalDb } from "./local-db";
import type { WorkspaceDataProvider } from "./workspace-provider";

/** Synthetic division for teams that have no local division (RFC §8). */
export const UNASSIGNED_DIVISION = "Unassigned";

export interface LocalExportPlayer {
  name: string;
  position: string;
  jerseyNumber: number | null;
  dateOfBirth: string | null;
  status: string;
}
export interface LocalExportTeam {
  name: string;
  city: string;
  stadium: string;
  logoUrl: string | null;
  players: LocalExportPlayer[];
}
export interface LocalExportDivision {
  name: string;
  teams: LocalExportTeam[];
}
export interface LocalExportSeason {
  name: string;
  startDate: string | null;
  endDate: string | null;
}
export interface LocalExportFixture {
  seasonName: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledAt: string | null;
  week: number | null;
  venue: string | null;
  result: { homeScore: number; awayScore: number } | null;
}

/**
 * Full serialized local workspace for the sign-up migration (RFC §8). The
 * `{ league, divisions }` head is a valid `LeagueImportPayload` (reused by the
 * server importer); seasons/fixtures ride alongside and are re-keyed by name
 * server-side. So one shape serves server import, local seed, AND this migration.
 */
export interface LocalWorkspaceExport {
  league: { name: string };
  divisions: LocalExportDivision[];
  seasons: LocalExportSeason[];
  fixtures: LocalExportFixture[];
  counts: {
    divisions: number;
    teams: number;
    players: number;
    seasons: number;
    fixtures: number;
  };
}

/** True when the browser holds a non-empty local workspace worth migrating. */
export async function hasLocalData(
  provider: WorkspaceDataProvider,
): Promise<boolean> {
  const leagues = await provider.listLeagues();
  if (leagues.length === 0) return false;
  const teams = await provider.listTeams(leagues[0].id);
  return teams.length > 0;
}

/**
 * Serialize the single local league into a migratable export, or `null` when
 * there's nothing to migrate (no league or no teams). Teams without a local
 * division are bucketed under "Unassigned" so the `{ league, divisions }` head
 * stays a valid import payload (every team needs a division there).
 */
export async function serializeLocalWorkspace(
  provider: WorkspaceDataProvider,
): Promise<LocalWorkspaceExport | null> {
  const leagues = await provider.listLeagues();
  if (leagues.length === 0) return null;
  const league = leagues[0];

  const [divisions, teams, seasons] = await Promise.all([
    provider.listDivisions(league.id),
    provider.listTeams(league.id),
    provider.listSeasons(league.id),
  ]);
  if (teams.length === 0) return null;

  const divisionNameById = new Map(divisions.map((d) => [d.id, d.name]));

  // Group teams by division name (insertion-ordered), bucketing the
  // division-less ones under "Unassigned".
  const groups = new Map<string, LocalExportTeam[]>();
  let playerCount = 0;
  for (const team of teams) {
    const divName =
      team.divisionId && divisionNameById.has(team.divisionId)
        ? divisionNameById.get(team.divisionId)!
        : UNASSIGNED_DIVISION;
    const players = await provider.listPlayersByTeam(team.id);
    playerCount += players.length;
    const exportTeam: LocalExportTeam = {
      name: team.name,
      city: team.city,
      stadium: team.stadium,
      logoUrl: team.logoUrl,
      players: players.map((p) => ({
        name: p.name,
        position: p.position,
        jerseyNumber: p.jerseyNumber,
        dateOfBirth: p.dateOfBirth,
        status: p.status,
      })),
    };
    const list = groups.get(divName) ?? [];
    list.push(exportTeam);
    groups.set(divName, list);
  }

  const exportDivisions: LocalExportDivision[] = Array.from(
    groups.entries(),
  ).map(([name, t]) => ({ name, teams: t }));

  // Seasons + fixtures (+ results), re-keyed by season/team NAME for the server.
  const seasonNameById = new Map(seasons.map((s) => [s.id, s.name]));
  const fixtures: LocalExportFixture[] = [];
  for (const season of seasons) {
    const seasonFixtures = await provider.listFixturesBySeason(season.id);
    for (const f of seasonFixtures) {
      const result = await provider.getResultByFixture(f.id);
      fixtures.push({
        seasonName: seasonNameById.get(f.seasonId) ?? season.name,
        homeTeamName: f.homeTeamName,
        awayTeamName: f.awayTeamName,
        scheduledAt: f.scheduledAt,
        week: f.week,
        venue: f.venue,
        result: result
          ? { homeScore: result.homeScore, awayScore: result.awayScore }
          : null,
      });
    }
  }

  return {
    league: { name: league.name },
    divisions: exportDivisions,
    seasons: seasons.map((s) => ({
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
    })),
    fixtures,
    counts: {
      divisions: exportDivisions.length,
      teams: teams.length,
      players: playerCount,
      seasons: seasons.length,
      fixtures: fixtures.length,
    },
  };
}

/**
 * Wipe the entire local workspace. Called after a successful migration so local
 * mode is cleared (AC #3) and the migration prompt never re-fires.
 */
export async function clearLocalWorkspace(
  db: WsmLocalDb = getLocalDb(),
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.leagues,
      db.divisions,
      db.teams,
      db.players,
      db.seasons,
      db.fixtures,
      db.gameResults,
      db.depthChart,
    ],
    async () => {
      await Promise.all([
        db.leagues.clear(),
        db.divisions.clear(),
        db.teams.clear(),
        db.players.clear(),
        db.seasons.clear(),
        db.fixtures.clear(),
        db.gameResults.clear(),
        db.depthChart.clear(),
      ]);
    },
  );
}
