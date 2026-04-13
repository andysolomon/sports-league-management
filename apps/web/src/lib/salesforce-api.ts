import { clerkClient } from "@clerk/nextjs/server";
import { getSalesforceConnection } from "./salesforce";
import { requireOrgAdmin } from "./org-context";
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

// Leagues
export function getLeagues(): Promise<LeagueDto[]> {
  return request<LeagueDto[]>("/leagues");
}

export function getLeague(id: string): Promise<LeagueDto> {
  return request<LeagueDto>(`/leagues/${id}`);
}

// Divisions
export function getDivisions(): Promise<DivisionDto[]> {
  return request<DivisionDto[]>("/divisions");
}

export function getDivision(id: string): Promise<DivisionDto> {
  return request<DivisionDto>(`/divisions/${id}`);
}

// Teams
export function getTeams(): Promise<TeamDto[]> {
  return request<TeamDto[]>("/teams");
}

export function getTeamsByLeague(leagueId: string): Promise<TeamDto[]> {
  return request<TeamDto[]>(`/teams?leagueId=${encodeURIComponent(leagueId)}`);
}

export function getTeam(id: string): Promise<TeamDto> {
  return request<TeamDto>(`/teams/${id}`);
}

// Players
export function getPlayers(): Promise<PlayerDto[]> {
  return request<PlayerDto[]>("/players");
}

export function getPlayer(id: string): Promise<PlayerDto> {
  return request<PlayerDto>(`/players/${id}`);
}

export function getPlayersByTeam(teamId: string): Promise<PlayerDto[]> {
  return request<PlayerDto[]>(`/players?teamId=${teamId}`);
}

// Seasons
export function getSeasons(): Promise<SeasonDto[]> {
  return request<SeasonDto[]>("/seasons");
}

export function getSeason(id: string): Promise<SeasonDto> {
  return request<SeasonDto>(`/seasons/${id}`);
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
  type TeamRec = {
    Id: string; Name: string; League__c: string; City__c: string;
    Stadium__c: string; Founded_Year__c: number | null;
    Location__c: string; Division__c: string; Logo_URL__c: string | null;
  };
  const existing = await conn.query<TeamRec>(
    `SELECT Id, Name, League__c, City__c, Stadium__c, Founded_Year__c, Location__c, Division__c, Logo_URL__c FROM Team__c WHERE Name = '${input.name.replace(/'/g, "\\'")}' AND League__c = '${input.leagueId}' LIMIT 1`,
  );

  const toDto = (rec: TeamRec): TeamDto => ({
    id: rec.Id,
    name: rec.Name,
    leagueId: rec.League__c,
    city: rec.City__c ?? "",
    stadium: rec.Stadium__c ?? "",
    foundedYear: rec.Founded_Year__c ?? null,
    location: rec.Location__c ?? "",
    divisionId: rec.Division__c ?? "",
    logoUrl: rec.Logo_URL__c ?? null,
  });

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
    return { dto: toDto(updated), created: false };
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
    dto: toDto({
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
  const existing = await conn.query<{
    Id: string; Name: string; Team__c: string; Position__c: string;
    Jersey_Number__c: number | null; Date_of_Birth__c: string | null; Status__c: string;
    Headshot_URL__c: string | null;
  }>(
    `SELECT Id, Name, Team__c, Position__c, Jersey_Number__c, Date_of_Birth__c, Status__c, Headshot_URL__c FROM Player__c WHERE Name = '${input.name.replace(/'/g, "\\'")}' AND Team__c = '${input.teamId}' LIMIT 1`,
  );

  const toDto = (rec: {
    Id: string; Name: string; Team__c: string; Position__c: string;
    Jersey_Number__c: number | null; Date_of_Birth__c: string | null; Status__c: string;
    Headshot_URL__c: string | null;
  }): PlayerDto => ({
    id: rec.Id,
    name: rec.Name,
    teamId: rec.Team__c,
    position: rec.Position__c ?? "",
    jerseyNumber: rec.Jersey_Number__c ?? null,
    dateOfBirth: rec.Date_of_Birth__c ?? null,
    status: rec.Status__c ?? "",
    headshotUrl: rec.Headshot_URL__c ?? null,
  });

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
      dto: toDto({
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
    dto: toDto({
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
