/**
 * One-off migration: Salesforce -> Convex.
 *
 * Usage from apps/web:
 *   pnpm dlx dotenv-cli -e .env.local -- pnpm dlx tsx scripts/backfill-salesforce-to-convex.mts
 */
import type { LeagueImportPayload } from "@sports-management/api-contracts";
import {
  bulkImportLeague,
  setLeagueInviteToken,
  updateSyncEnabled,
  upsertSeason,
  writeSyncReport,
} from "../src/lib/data-api.ts";
import { getSalesforceConnection } from "../src/lib/salesforce.ts";

type LeagueRecord = {
  Id: string;
  Name: string;
  Clerk_Org_Id__c: string | null;
  Invite_Token__c: string | null;
};

type DivisionRecord = {
  Id: string;
  Name: string;
  League__c: string;
};

type TeamRecord = {
  Id: string;
  Name: string;
  League__c: string;
  Division__c: string | null;
  City__c: string | null;
  Stadium__c: string | null;
  Logo_URL__c: string | null;
};

type PlayerRecord = {
  Id: string;
  Name: string;
  Team__c: string;
  Position__c: string | null;
  Jersey_Number__c: number | null;
  Date_of_Birth__c: string | null;
  Status__c: string | null;
  Headshot_URL__c: string | null;
};

type SeasonRecord = {
  Id: string;
  Name: string;
  League__c: string;
  Start_Date__c: string | null;
  End_Date__c: string | null;
  Status__c: string | null;
};

type SyncConfigRecord = {
  Sync_Enabled__c: boolean;
  Last_Sync_Report__c: string | null;
};

function safeDivisionName(name: string | null | undefined): string {
  return name?.trim() || "Imported";
}

async function main() {
  const conn = await getSalesforceConnection();

  const [leaguesResult, divisionsResult, teamsResult, playersResult, seasonsResult] =
    await Promise.all([
      conn.query<LeagueRecord>(
        "SELECT Id, Name, Clerk_Org_Id__c, Invite_Token__c FROM League__c",
      ),
      conn.query<DivisionRecord>("SELECT Id, Name, League__c FROM Division__c"),
      conn.query<TeamRecord>(
        "SELECT Id, Name, League__c, Division__c, City__c, Stadium__c, Logo_URL__c FROM Team__c",
      ),
      conn.query<PlayerRecord>(
        "SELECT Id, Name, Team__c, Position__c, Jersey_Number__c, Date_of_Birth__c, Status__c, Headshot_URL__c FROM Player__c",
      ),
      conn.query<SeasonRecord>(
        "SELECT Id, Name, League__c, Start_Date__c, End_Date__c, Status__c FROM Season__c",
      ),
    ]);

  let syncConfigResult:
    | {
        totalSize: number;
        records: SyncConfigRecord[];
      }
    | null = null;

  const globalDescribe = await conn.describeGlobal();
  const hasSyncConfigObject = globalDescribe.sobjects.some(
    (object) => object.name === "NFL_Sync_Config__c",
  );

  if (hasSyncConfigObject) {
    syncConfigResult = await conn.query<SyncConfigRecord>(
      "SELECT Sync_Enabled__c, Last_Sync_Report__c FROM NFL_Sync_Config__c LIMIT 1",
    );
  }

  const leagues = leaguesResult.records;
  const divisions = divisionsResult.records;
  const teams = teamsResult.records;
  const players = playersResult.records;
  const seasons = seasonsResult.records;

  const divisionsByLeague = new Map<string, DivisionRecord[]>();
  for (const division of divisions) {
    const existing = divisionsByLeague.get(division.League__c) ?? [];
    existing.push(division);
    divisionsByLeague.set(division.League__c, existing);
  }

  const teamsByLeague = new Map<string, TeamRecord[]>();
  for (const team of teams) {
    const existing = teamsByLeague.get(team.League__c) ?? [];
    existing.push(team);
    teamsByLeague.set(team.League__c, existing);
  }

  const playersByTeam = new Map<string, PlayerRecord[]>();
  for (const player of players) {
    const existing = playersByTeam.get(player.Team__c) ?? [];
    existing.push(player);
    playersByTeam.set(player.Team__c, existing);
  }

  const seasonsByLeague = new Map<string, SeasonRecord[]>();
  for (const season of seasons) {
    const existing = seasonsByLeague.get(season.League__c) ?? [];
    existing.push(season);
    seasonsByLeague.set(season.League__c, existing);
  }

  const teamCountByDivision = new Map<string, TeamRecord[]>();
  for (const team of teams) {
    const key = team.Division__c ?? `league:${team.League__c}`;
    const existing = teamCountByDivision.get(key) ?? [];
    existing.push(team);
    teamCountByDivision.set(key, existing);
  }

  const migrationSummary: Array<{
    leagueName: string;
    importedLeagueId: string;
    result: Awaited<ReturnType<typeof bulkImportLeague>>;
  }> = [];

  for (const league of leagues) {
    const leagueDivisions = divisionsByLeague.get(league.Id) ?? [];
    const leagueTeams = teamsByLeague.get(league.Id) ?? [];

    const payloadDivisions: LeagueImportPayload["divisions"] =
      leagueDivisions.length > 0
        ? leagueDivisions
            .map((division) => ({
              name: safeDivisionName(division.Name),
              teams:
                (teamCountByDivision.get(division.Id) ?? []).map((team) => ({
                  name: team.Name,
                  city: team.City__c ?? "",
                  stadium: team.Stadium__c ?? "",
                  logoUrl: team.Logo_URL__c ?? null,
                  players: (playersByTeam.get(team.Id) ?? []).map((player) => ({
                    name: player.Name,
                    position: player.Position__c ?? "Unknown",
                    jerseyNumber: player.Jersey_Number__c ?? null,
                    dateOfBirth: player.Date_of_Birth__c ?? null,
                    status: player.Status__c ?? "Active",
                    headshotUrl: player.Headshot_URL__c ?? null,
                  })),
                })),
            }))
            .filter((division) => division.teams.length > 0)
        : [];

    if (payloadDivisions.length === 0 && leagueTeams.length > 0) {
      payloadDivisions.push({
        name: "Imported",
        teams: leagueTeams.map((team) => ({
          name: team.Name,
          city: team.City__c ?? "",
          stadium: team.Stadium__c ?? "",
          logoUrl: team.Logo_URL__c ?? null,
          players: (playersByTeam.get(team.Id) ?? []).map((player) => ({
            name: player.Name,
            position: player.Position__c ?? "Unknown",
            jerseyNumber: player.Jersey_Number__c ?? null,
            dateOfBirth: player.Date_of_Birth__c ?? null,
            status: player.Status__c ?? "Active",
            headshotUrl: player.Headshot_URL__c ?? null,
          })),
        })),
      });
    }

    if (payloadDivisions.length === 0) {
      continue;
    }

    const payload: LeagueImportPayload = {
      league: { name: league.Name },
      divisions: payloadDivisions,
    };

    const result = await bulkImportLeague(
      payload,
      undefined,
      league.Clerk_Org_Id__c ?? null,
    );

    if (league.Invite_Token__c) {
      await setLeagueInviteToken(result.leagueId, league.Invite_Token__c);
    }

    const leagueSeasons = seasonsByLeague.get(league.Id) ?? [];
    for (const season of leagueSeasons) {
      await upsertSeason({
        name: season.Name,
        leagueId: result.leagueId,
        startDate: season.Start_Date__c ?? null,
        endDate: season.End_Date__c ?? null,
        status: season.Status__c ?? "",
      });
    }

    migrationSummary.push({
      leagueName: league.Name,
      importedLeagueId: result.leagueId,
      result,
    });
  }

  if (syncConfigResult && syncConfigResult.totalSize > 0) {
    const record = syncConfigResult.records[0];
    await updateSyncEnabled(record.Sync_Enabled__c);
    if (record.Last_Sync_Report__c) {
      try {
        await writeSyncReport(JSON.parse(record.Last_Sync_Report__c));
      } catch {
        // Ignore malformed legacy sync reports.
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        migratedLeagues: migrationSummary.length,
        sourceCounts: {
          leagues: leagues.length,
          divisions: divisions.length,
          teams: teams.length,
          players: players.length,
          seasons: seasons.length,
        },
        migrationSummary,
      },
      null,
      2,
    ),
  );
}

await main();
