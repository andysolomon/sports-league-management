import { clerkClient } from "@clerk/nextjs/server";
import { getSalesforceConnection } from "./salesforce";
import { requireOrgAdmin, requireLeagueAccess, type OrgContext } from "./org-context";
import type {
  ApiResponse,
  LeagueDto,
  DivisionDto,
  TeamDto,
  PlayerDto,
  SeasonDto,
  CreatePlayerInput,
  UpdatePlayerInput,
  CreateTeamInput,
  UpdateTeamInput,
  ImportResult,
  ImportError,
} from "@sports-management/shared-types";
import type { LeagueImportPayload } from "@sports-management/api-contracts";

const BASE = "/services/apexrest/sportsmgmt/v1";

async function request<T>(path: string): Promise<T> {
  const conn = await getSalesforceConnection();
  const raw = await conn.request(`${BASE}${path}`);
  const res = (typeof raw === "string" ? JSON.parse(raw) : raw) as ApiResponse<T>;
  if (!res.success) {
    throw new Error(res.message ?? "Salesforce API error");
  }
  return res.data;
}

async function mutate<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const conn = await getSalesforceConnection();
  const raw = await conn.request({
    url: `${conn.instanceUrl}${BASE}${path}`,
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
  const res = (typeof raw === "string" ? JSON.parse(raw) : raw) as ApiResponse<T>;
  if (!res.success) {
    throw new Error(res.message ?? "Salesforce API error");
  }
  return res.data;
}

// --- Org-scoped read functions (direct SOQL via jsforce) ---

function idList(ids: string[]): string {
  return ids.map((id) => `'${id}'`).join(",");
}

// Public leagues (no org context required)
export async function getPublicLeagues(): Promise<LeagueDto[]> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string; Name: string; Clerk_Org_Id__c: string | null }>(
    "SELECT Id, Name, Clerk_Org_Id__c FROM League__c WHERE Clerk_Org_Id__c = null",
  );
  return result.records.map((r) => ({ id: r.Id, name: r.Name, orgId: r.Clerk_Org_Id__c ?? null }));
}

// Invite token helpers
export async function getLeagueByInviteToken(
  token: string,
): Promise<{ leagueId: string; orgId: string | null; name: string } | null> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string; Name: string; Clerk_Org_Id__c: string | null }>(
    `SELECT Id, Name, Clerk_Org_Id__c FROM League__c WHERE Invite_Token__c = '${token.replace(/'/g, "\\'")}' LIMIT 1`,
  );
  if (result.totalSize === 0) return null;
  const r = result.records[0];
  return { leagueId: r.Id, orgId: r.Clerk_Org_Id__c ?? null, name: r.Name };
}

export async function setLeagueInviteToken(
  leagueId: string,
  token: string | null,
): Promise<void> {
  const conn = await getSalesforceConnection();
  await conn.sobject("League__c").update({
    Id: leagueId,
    Invite_Token__c: token,
  });
}

// Leagues
export async function getLeagues(visibleLeagueIds: string[]): Promise<LeagueDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string; Name: string; Clerk_Org_Id__c: string | null }>(
    `SELECT Id, Name, Clerk_Org_Id__c FROM League__c WHERE Id IN (${idList(visibleLeagueIds)})`,
  );
  return result.records.map((r) => ({ id: r.Id, name: r.Name, orgId: r.Clerk_Org_Id__c ?? null }));
}

export async function getLeague(id: string, orgContext: OrgContext): Promise<LeagueDto> {
  requireLeagueAccess(id, orgContext);
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string; Name: string; Clerk_Org_Id__c: string | null }>(
    `SELECT Id, Name, Clerk_Org_Id__c FROM League__c WHERE Id = '${id}' LIMIT 1`,
  );
  if (result.totalSize === 0) throw new Error("League not found");
  const r = result.records[0];
  return { id: r.Id, name: r.Name, orgId: r.Clerk_Org_Id__c ?? null };
}

// Divisions
export async function getDivisions(visibleLeagueIds: string[]): Promise<DivisionDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string; Name: string; League__c: string }>(
    `SELECT Id, Name, League__c FROM Division__c WHERE League__c IN (${idList(visibleLeagueIds)})`,
  );
  return result.records.map((r) => ({ id: r.Id, name: r.Name, leagueId: r.League__c }));
}

export async function getDivision(id: string, orgContext: OrgContext): Promise<DivisionDto> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Id: string; Name: string; League__c: string }>(
    `SELECT Id, Name, League__c FROM Division__c WHERE Id = '${id}' LIMIT 1`,
  );
  if (result.totalSize === 0) throw new Error("Division not found");
  const r = result.records[0];
  requireLeagueAccess(r.League__c, orgContext);
  return { id: r.Id, name: r.Name, leagueId: r.League__c };
}

// Teams
type TeamRec = {
  Id: string; Name: string; League__c: string; City__c: string;
  Stadium__c: string; Founded_Year__c: number | null;
  Location__c: string; Division__c: string; Logo_URL__c: string | null;
};

const TEAM_FIELDS = "Id, Name, League__c, City__c, Stadium__c, Founded_Year__c, Location__c, Division__c, Logo_URL__c";

function teamRecToDto(r: TeamRec): TeamDto {
  return {
    id: r.Id, name: r.Name, leagueId: r.League__c, city: r.City__c ?? "",
    stadium: r.Stadium__c ?? "", foundedYear: r.Founded_Year__c ?? null,
    location: r.Location__c ?? "", divisionId: r.Division__c ?? "",
    logoUrl: r.Logo_URL__c ?? null,
  };
}

export async function getTeams(visibleLeagueIds: string[]): Promise<TeamDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  const conn = await getSalesforceConnection();
  const result = await conn.query<TeamRec>(
    `SELECT ${TEAM_FIELDS} FROM Team__c WHERE League__c IN (${idList(visibleLeagueIds)})`,
  );
  return result.records.map(teamRecToDto);
}

export async function getTeamsByLeague(leagueId: string, orgContext: OrgContext): Promise<TeamDto[]> {
  requireLeagueAccess(leagueId, orgContext);
  const conn = await getSalesforceConnection();
  const result = await conn.query<TeamRec>(
    `SELECT ${TEAM_FIELDS} FROM Team__c WHERE League__c = '${leagueId}'`,
  );
  return result.records.map(teamRecToDto);
}

export async function getTeam(id: string, orgContext: OrgContext): Promise<TeamDto> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<TeamRec>(
    `SELECT ${TEAM_FIELDS} FROM Team__c WHERE Id = '${id}' LIMIT 1`,
  );
  if (result.totalSize === 0) throw new Error("Team not found");
  const r = result.records[0];
  requireLeagueAccess(r.League__c, orgContext);
  return teamRecToDto(r);
}

// Players
type PlayerRec = {
  Id: string; Name: string; Team__c: string; Position__c: string;
  Jersey_Number__c: number | null; Date_of_Birth__c: string | null;
  Status__c: string; Headshot_URL__c: string | null;
};

const PLAYER_FIELDS = "Id, Name, Team__c, Position__c, Jersey_Number__c, Date_of_Birth__c, Status__c, Headshot_URL__c";

function playerRecToDto(r: PlayerRec): PlayerDto {
  return {
    id: r.Id, name: r.Name, teamId: r.Team__c, position: r.Position__c ?? "",
    jerseyNumber: r.Jersey_Number__c ?? null, dateOfBirth: r.Date_of_Birth__c ?? null,
    status: r.Status__c ?? "", headshotUrl: r.Headshot_URL__c ?? null,
  };
}

export async function getPlayers(visibleLeagueIds: string[]): Promise<PlayerDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  const conn = await getSalesforceConnection();
  const result = await conn.query<PlayerRec>(
    `SELECT ${PLAYER_FIELDS} FROM Player__c WHERE Team__r.League__c IN (${idList(visibleLeagueIds)})`,
  );
  return result.records.map(playerRecToDto);
}

export async function getPlayer(id: string, orgContext: OrgContext): Promise<PlayerDto> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<PlayerRec & { Team__r: { League__c: string } }>(
    `SELECT ${PLAYER_FIELDS}, Team__r.League__c FROM Player__c WHERE Id = '${id}' LIMIT 1`,
  );
  if (result.totalSize === 0) throw new Error("Player not found");
  const r = result.records[0];
  requireLeagueAccess(r.Team__r.League__c, orgContext);
  return playerRecToDto(r);
}

export async function getPlayersByTeam(teamId: string, orgContext: OrgContext): Promise<PlayerDto[]> {
  // Verify team's league is accessible
  const conn = await getSalesforceConnection();
  const teamResult = await conn.query<{ League__c: string }>(
    `SELECT League__c FROM Team__c WHERE Id = '${teamId}' LIMIT 1`,
  );
  if (teamResult.totalSize === 0) throw new Error("Team not found");
  requireLeagueAccess(teamResult.records[0].League__c, orgContext);

  const result = await conn.query<PlayerRec>(
    `SELECT ${PLAYER_FIELDS} FROM Player__c WHERE Team__c = '${teamId}'`,
  );
  return result.records.map(playerRecToDto);
}

// Seasons
export async function getSeasons(visibleLeagueIds: string[]): Promise<SeasonDto[]> {
  if (visibleLeagueIds.length === 0) return [];
  const conn = await getSalesforceConnection();
  const result = await conn.query<{
    Id: string; Name: string; League__c: string;
    Start_Date__c: string | null; End_Date__c: string | null; Status__c: string;
  }>(
    `SELECT Id, Name, League__c, Start_Date__c, End_Date__c, Status__c FROM Season__c WHERE League__c IN (${idList(visibleLeagueIds)})`,
  );
  return result.records.map((r) => ({
    id: r.Id, name: r.Name, leagueId: r.League__c,
    startDate: r.Start_Date__c ?? null, endDate: r.End_Date__c ?? null,
    status: r.Status__c ?? "",
  }));
}

export async function getSeason(id: string, orgContext: OrgContext): Promise<SeasonDto> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<{
    Id: string; Name: string; League__c: string;
    Start_Date__c: string | null; End_Date__c: string | null; Status__c: string;
  }>(
    `SELECT Id, Name, League__c, Start_Date__c, End_Date__c, Status__c FROM Season__c WHERE Id = '${id}' LIMIT 1`,
  );
  if (result.totalSize === 0) throw new Error("Season not found");
  const r = result.records[0];
  requireLeagueAccess(r.League__c, orgContext);
  return {
    id: r.Id, name: r.Name, leagueId: r.League__c,
    startDate: r.Start_Date__c ?? null, endDate: r.End_Date__c ?? null,
    status: r.Status__c ?? "",
  };
}

// Player mutations
export function createPlayer(input: CreatePlayerInput): Promise<PlayerDto> {
  return mutate<PlayerDto>("/players", "POST", input);
}

export function updatePlayer(
  id: string,
  input: UpdatePlayerInput,
): Promise<PlayerDto> {
  return mutate<PlayerDto>(`/players/${id}`, "PUT", input);
}

export function deletePlayer(id: string): Promise<null> {
  return mutate<null>(`/players/${id}`, "DELETE");
}

// Team mutations
export function createTeam(input: CreateTeamInput): Promise<TeamDto> {
  return mutate<TeamDto>("/teams", "POST", input);
}

export function updateTeam(
  id: string,
  input: UpdateTeamInput,
): Promise<TeamDto> {
  return mutate<TeamDto>(`/teams/${id}`, "PUT", input);
}

// --- Upsert functions (direct sObject operations for import) ---

export async function upsertLeague(
  name: string,
  createdByUserId?: string,
): Promise<{ dto: LeagueDto; created: boolean }> {
  const conn = await getSalesforceConnection();
  const existing = await conn.query<{ Id: string; Name: string; Clerk_Org_Id__c: string | null }>(
    `SELECT Id, Name, Clerk_Org_Id__c FROM League__c WHERE Name = '${name.replace(/'/g, "\\'")}'  LIMIT 1`,
  );

  if (existing.totalSize > 0) {
    const rec = existing.records[0];
    // If league exists and has an org, verify user is admin of that org
    if (rec.Clerk_Org_Id__c && createdByUserId) {
      await requireOrgAdmin(rec.Clerk_Org_Id__c, createdByUserId);
    }
    return { dto: { id: rec.Id, name: rec.Name, orgId: rec.Clerk_Org_Id__c ?? null }, created: false };
  }

  // Create Clerk Organization if we have a user context
  let orgId: string | null = null;
  if (createdByUserId) {
    const client = await clerkClient();
    const org = await client.organizations.createOrganization({
      name,
      createdBy: createdByUserId,
    });
    orgId = org.id;
  }

  const result = await conn.sobject("League__c").create({
    Name: name,
    Clerk_Org_Id__c: orgId,
  });
  if (!result.success) {
    throw new Error(`Failed to create league: ${result.errors?.map((e) => e.message).join(", ") ?? "unknown error"}`);
  }
  return { dto: { id: result.id, name, orgId }, created: true };
}

export async function upsertDivision(
  name: string,
  leagueId: string,
): Promise<{ dto: DivisionDto; created: boolean }> {
  const conn = await getSalesforceConnection();
  const existing = await conn.query<{ Id: string; Name: string; League__c: string }>(
    `SELECT Id, Name, League__c FROM Division__c WHERE Name = '${name.replace(/'/g, "\\'")}' AND League__c = '${leagueId}' LIMIT 1`,
  );

  if (existing.totalSize > 0) {
    const rec = existing.records[0];
    return { dto: { id: rec.Id, name: rec.Name, leagueId: rec.League__c }, created: false };
  }

  const result = await conn.sobject("Division__c").create({ Name: name, League__c: leagueId });
  if (!result.success) {
    throw new Error(`Failed to create division: ${result.errors?.map((e) => e.message).join(", ") ?? "unknown error"}`);
  }
  return { dto: { id: result.id, name, leagueId }, created: true };
}

export async function upsertTeam(input: {
  name: string;
  city: string;
  stadium: string;
  leagueId: string;
  divisionId: string;
  logoUrl?: string | null;
}): Promise<{ dto: TeamDto; created: boolean }> {
  const conn = await getSalesforceConnection();
  const existing = await conn.query<TeamRec>(
    `SELECT ${TEAM_FIELDS} FROM Team__c WHERE Name = '${input.name.replace(/'/g, "\\'")}' AND League__c = '${input.leagueId}' LIMIT 1`,
  );

  if (existing.totalSize > 0) {
    const rec = existing.records[0];
    await conn.sobject("Team__c").update({
      Id: rec.Id,
      City__c: input.city,
      Stadium__c: input.stadium,
      Division__c: input.divisionId,
      ...(input.logoUrl !== undefined && { Logo_URL__c: input.logoUrl }),
    });
    const updated = { ...rec, City__c: input.city, Stadium__c: input.stadium, Division__c: input.divisionId, Logo_URL__c: input.logoUrl ?? rec.Logo_URL__c };
    return { dto: teamRecToDto(updated), created: false };
  }

  const result = await conn.sobject("Team__c").create({
    Name: input.name,
    League__c: input.leagueId,
    City__c: input.city,
    Stadium__c: input.stadium,
    Division__c: input.divisionId,
    Logo_URL__c: input.logoUrl ?? null,
  });
  if (!result.success) {
    throw new Error(`Failed to create team: ${result.errors?.map((e) => e.message).join(", ") ?? "unknown error"}`);
  }
  return {
    dto: teamRecToDto({
      Id: result.id, Name: input.name, League__c: input.leagueId,
      City__c: input.city, Stadium__c: input.stadium,
      Founded_Year__c: null, Location__c: "", Division__c: input.divisionId,
      Logo_URL__c: input.logoUrl ?? null,
    }),
    created: true,
  };
}

export async function upsertPlayer(input: {
  name: string;
  teamId: string;
  position: string;
  jerseyNumber?: number | null;
  dateOfBirth?: string | null;
  status: string;
  headshotUrl?: string | null;
}): Promise<{ dto: PlayerDto; created: boolean }> {
  const conn = await getSalesforceConnection();
  const existing = await conn.query<PlayerRec>(
    `SELECT ${PLAYER_FIELDS} FROM Player__c WHERE Name = '${input.name.replace(/'/g, "\\'")}' AND Team__c = '${input.teamId}' LIMIT 1`,
  );

  if (existing.totalSize > 0) {
    const rec = existing.records[0];
    await conn.sobject("Player__c").update({
      Id: rec.Id,
      Position__c: input.position,
      Jersey_Number__c: input.jerseyNumber ?? null,
      Date_of_Birth__c: input.dateOfBirth ?? null,
      Status__c: input.status,
      ...(input.headshotUrl !== undefined && { Headshot_URL__c: input.headshotUrl }),
    });
    return {
      dto: playerRecToDto({
        ...rec,
        Position__c: input.position,
        Jersey_Number__c: input.jerseyNumber ?? null,
        Date_of_Birth__c: input.dateOfBirth ?? null,
        Status__c: input.status,
        Headshot_URL__c: input.headshotUrl ?? rec.Headshot_URL__c,
      }),
      created: false,
    };
  }

  const result = await conn.sobject("Player__c").create({
    Name: input.name,
    Team__c: input.teamId,
    Position__c: input.position,
    Jersey_Number__c: input.jerseyNumber ?? null,
    Date_of_Birth__c: input.dateOfBirth ?? null,
    Status__c: input.status,
    Headshot_URL__c: input.headshotUrl ?? null,
  });
  if (!result.success) {
    throw new Error(`Failed to create player: ${result.errors?.map((e) => e.message).join(", ") ?? "unknown error"}`);
  }
  return {
    dto: playerRecToDto({
      Id: result.id, Name: input.name, Team__c: input.teamId,
      Position__c: input.position, Jersey_Number__c: input.jerseyNumber ?? null,
      Date_of_Birth__c: input.dateOfBirth ?? null, Status__c: input.status,
      Headshot_URL__c: input.headshotUrl ?? null,
    }),
    created: true,
  };
}

// --- Bulk import orchestrator ---

export async function bulkImportLeague(
  payload: LeagueImportPayload,
  createdByUserId?: string,
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  const created = { leagues: 0, divisions: 0, teams: 0, players: 0 };
  const updated = { leagues: 0, divisions: 0, teams: 0, players: 0 };

  // 1. Upsert league
  let leagueId: string;
  try {
    const leagueResult = await upsertLeague(payload.league.name, createdByUserId);
    leagueId = leagueResult.dto.id;
    if (leagueResult.created) created.leagues++; else updated.leagues++;
  } catch (err) {
    throw new Error(`Failed to upsert league "${payload.league.name}": ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Upsert divisions, then teams within each division, then players within each team
  for (const div of payload.divisions) {
    let divisionId: string;
    try {
      const divResult = await upsertDivision(div.name, leagueId);
      divisionId = divResult.dto.id;
      if (divResult.created) created.divisions++; else updated.divisions++;
    } catch (err) {
      errors.push({ entity: "division", name: div.name, message: err instanceof Error ? err.message : String(err) });
      continue; // skip teams in this division
    }

    for (const team of div.teams) {
      let teamId: string;
      try {
        const teamResult = await upsertTeam({
          name: team.name,
          city: team.city,
          stadium: team.stadium,
          leagueId,
          divisionId,
          logoUrl: team.logoUrl,
        });
        teamId = teamResult.dto.id;
        if (teamResult.created) created.teams++; else updated.teams++;
      } catch (err) {
        errors.push({ entity: "team", name: team.name, message: err instanceof Error ? err.message : String(err) });
        continue; // skip players on this team
      }

      for (const player of team.players) {
        try {
          const playerResult = await upsertPlayer({
            name: player.name,
            teamId,
            position: player.position,
            jerseyNumber: player.jerseyNumber,
            dateOfBirth: player.dateOfBirth,
            status: player.status,
            headshotUrl: player.headshotUrl,
          });
          if (playerResult.created) created.players++; else updated.players++;
        } catch (err) {
          errors.push({ entity: "player", name: player.name, message: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  }

  return { leagueId, created, updated, errors };
}
