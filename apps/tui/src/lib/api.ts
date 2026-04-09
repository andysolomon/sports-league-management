import { apiTracker } from "./api-tracker.js";
import { errorTracker } from "./error-tracker.js";

const RETRY_DELAY_MS = 500;

async function instrumentedFetch(
  url: string,
  options: RequestInit,
  errorLabel: string,
): Promise<Response> {
  const parsedUrl = new URL(url);
  const path = parsedUrl.pathname + parsedUrl.search;
  const method = options.method ?? "GET";

  // Attempt fetch with one retry on network errors
  let res: Response;
  try {
    const start = Date.now();
    res = await fetch(url, options);
    apiTracker.record({
      method,
      path,
      status: res.status,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (networkErr) {
    // Network error (ECONNREFUSED, timeout, DNS) — retry once after delay
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    try {
      const start = Date.now();
      res = await fetch(url, options);
      apiTracker.record({
        method,
        path,
        status: res.status,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Retry also failed — surface actionable error
      const baseUrl = parsedUrl.origin;
      const message = `Cannot reach the server at ${baseUrl}. Check your network and SPRTSMNG_API_URL.`;
      errorTracker.record({
        timestamp: new Date().toISOString(),
        status: 0,
        route: path,
        message,
        payload: networkErr instanceof Error ? networkErr.message : String(networkErr),
      });
      throw new Error(message);
    }
  }

  // Handle HTTP errors
  if (!res.ok) {
    let payload: unknown = null;
    let bffMessage: string | null = null;
    try {
      const body = await res.clone().json();
      payload = body;
      bffMessage =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>).message as string ??
            (body as Record<string, unknown>).error as string ??
            null
          : null;
    } catch {
      // response body isn't JSON
    }

    // 401 — expired or revoked credentials
    let message: string;
    if (res.status === 401) {
      message =
        "Your session has expired or been revoked. Run 'pnpm tui login' to re-authenticate.";
    } else if (bffMessage) {
      // Use the BFF's user-facing message when available (e.g., 503)
      message = `${errorLabel}: ${bffMessage}`;
    } else {
      message = `${errorLabel}: ${res.status} ${res.statusText}`;
    }

    errorTracker.record({
      timestamp: new Date().toISOString(),
      status: res.status,
      route: path,
      message,
      payload,
    });
    throw new Error(message);
  }

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
  const res = await instrumentedFetch(
    `${baseUrl}/api/cli/leagues`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "Failed to fetch leagues",
  );
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
  const res = await instrumentedFetch(
    `${baseUrl}/api/cli/teams?leagueId=${encodeURIComponent(leagueId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "Failed to fetch teams",
  );
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
  const res = await instrumentedFetch(
    `${baseUrl}/api/cli/players?teamId=${encodeURIComponent(teamId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "Failed to fetch players",
  );
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
  const res = await instrumentedFetch(
    `${baseUrl}/api/cli/seasons`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "Failed to fetch seasons",
  );
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
  const res = await instrumentedFetch(
    `${baseUrl}/api/cli/divisions`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "Failed to fetch divisions",
  );
  return (await res.json()) as DivisionDto[];
}

export interface CreateTeamInput {
  name: string;
  leagueId: string;
  city: string;
  stadium: string;
}

export async function createTeam(
  baseUrl: string,
  apiKey: string,
  input: CreateTeamInput,
): Promise<TeamDto> {
  const res = await instrumentedFetch(
    `${baseUrl}/api/cli/teams`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
    "Failed to create team",
  );
  return (await res.json()) as TeamDto;
}

export async function reassignPlayer(
  baseUrl: string,
  apiKey: string,
  playerId: string,
  newTeamId: string,
): Promise<PlayerDto> {
  const res = await instrumentedFetch(
    `${baseUrl}/api/cli/players/${encodeURIComponent(playerId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ teamId: newTeamId }),
    },
    "Failed to reassign player",
  );
  return (await res.json()) as PlayerDto;
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
  const res = await instrumentedFetch(
    `${baseUrl}/api/cli/whoami`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    "Verification failed",
  );
  return (await res.json()) as WhoamiResponse;
}
