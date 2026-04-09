import { apiTracker } from "./api-tracker.js";

async function trackedFetch(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const start = Date.now();
  const res = await fetch(url, options);
  const parsedUrl = new URL(url);
  apiTracker.record({
    method: options.method ?? "GET",
    path: parsedUrl.pathname + parsedUrl.search,
    status: res.status,
    durationMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  });
  return res;
}

export interface LeagueDto {
  id: string;
  name: string;
}

export async function fetchLeagues(
  baseUrl: string,
  apiKey: string,
): Promise<LeagueDto[]> {
  const res = await trackedFetch(`${baseUrl}/api/cli/leagues`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch leagues: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as LeagueDto[];
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
}

export async function fetchTeams(
  baseUrl: string,
  apiKey: string,
  leagueId: string,
): Promise<TeamDto[]> {
  const res = await fetch(
    `${baseUrl}/api/cli/teams?leagueId=${encodeURIComponent(leagueId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch teams: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as TeamDto[];
}

export interface PlayerDto {
  id: string;
  name: string;
  teamId: string;
  position: string;
  jerseyNumber: number | null;
  dateOfBirth: string | null;
  status: string;
}

export async function fetchPlayers(
  baseUrl: string,
  apiKey: string,
  teamId: string,
): Promise<PlayerDto[]> {
  const res = await fetch(
    `${baseUrl}/api/cli/players?teamId=${encodeURIComponent(teamId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch players: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as PlayerDto[];
}

export interface SeasonDto {
  id: string;
  name: string;
  leagueId: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

export async function fetchSeasons(
  baseUrl: string,
  apiKey: string,
): Promise<SeasonDto[]> {
  const res = await trackedFetch(`${baseUrl}/api/cli/seasons`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch seasons: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SeasonDto[];
}

export interface DivisionDto {
  id: string;
  name: string;
  leagueId: string;
}

export async function fetchDivisions(
  baseUrl: string,
  apiKey: string,
): Promise<DivisionDto[]> {
  const res = await trackedFetch(`${baseUrl}/api/cli/divisions`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch divisions: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as DivisionDto[];
}

export interface WhoamiResponse {
  userId: string;
  email: string | null;
  tier: "free" | "plus" | "club" | "league";
  authMethod: "session_token" | "api_key";
}

export async function verifyApiKey(
  baseUrl: string,
  apiKey: string,
): Promise<WhoamiResponse> {
  const res = await trackedFetch(`${baseUrl}/api/cli/whoami`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Verification failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as WhoamiResponse;
}
