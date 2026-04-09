import { getSalesforceConnection } from "./salesforce";
import type {
  ApiResponse,
  LeagueDto,
  DivisionDto,
  TeamDto,
  PlayerDto,
  SeasonDto,
  CreatePlayerInput,
  UpdatePlayerInput,
  UpdateTeamInput,
} from "@sports-management/shared-types";

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
export function updateTeam(
  id: string,
  input: UpdateTeamInput,
): Promise<TeamDto> {
  return mutate<TeamDto>(`/teams/${id}`, "PUT", input);
}
