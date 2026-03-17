import { getSalesforceConnection } from "./salesforce";
import type {
  ApiResponse,
  LeagueDto,
  DivisionDto,
  TeamDto,
  PlayerDto,
  SeasonDto,
} from "@sports-management/shared-types";

const BASE = "/services/apexrest/sportsmgmt/v1";

async function request<T>(path: string): Promise<T> {
  const conn = await getSalesforceConnection();
  const res = (await conn.request(`${BASE}${path}`)) as ApiResponse<T>;
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
