import type { LeagueImportPayload } from "@sports-management/api-contracts";
import type { IDataSourceAdapter } from "./types";

const TEAMS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const GROUPS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/groups";
const ROSTER_URL = (teamId: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`;
const TEAM_DETAIL_URL = (teamId: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}`;

const DELAY_MS = 200;

// --- ESPN response types ---

interface EspnTeamRef {
  id: string;
  displayName: string;
  name: string;
  location: string;
  abbreviation: string;
  logos?: { href: string }[];
}

interface EspnGroupChild {
  name: string; // e.g. "AFC East"
  teams: { id: string; displayName: string }[];
}

interface EspnGroupsResponse {
  groups: {
    name: string; // "American Football Conference" / "National Football Conference"
    abbreviation: string;
    children: EspnGroupChild[];
  }[];
}

interface EspnTeamsResponse {
  sports: {
    leagues: {
      teams: { team: EspnTeamRef }[];
    }[];
  }[];
}

interface EspnTeamDetailResponse {
  team: EspnTeamRef & {
    franchise?: {
      venue?: { fullName?: string };
    };
  };
}

interface EspnRosterResponse {
  athletes: {
    position: string; // "offense", "defense", etc.
    items: {
      fullName: string;
      jersey?: string;
      dateOfBirth?: string;
      position: { abbreviation: string };
      status?: { name: string };
      headshot?: { href: string };
    }[];
  }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN API ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export class EspnNflAdapter implements IDataSourceAdapter {
  async fetchLeagueData(): Promise<LeagueImportPayload> {
    // 1. Fetch groups (divisions) to get team-to-division mapping
    const groupsData = await fetchJson<EspnGroupsResponse>(GROUPS_URL);

    // 2. Fetch all teams for full team data (logos, location)
    const teamsData = await fetchJson<EspnTeamsResponse>(TEAMS_URL);
    const teamMap = new Map<string, EspnTeamRef>();
    for (const { team } of teamsData.sports[0].leagues[0].teams) {
      teamMap.set(team.id, team);
    }

    // 3. Build divisions with teams and rosters
    const divisions: LeagueImportPayload["divisions"] = [];

    for (const conference of groupsData.groups) {
      for (const division of conference.children) {
        const divisionName = division.name; // "AFC East", "NFC West", etc.

        const teams: LeagueImportPayload["divisions"][number]["teams"] = [];

        for (const groupTeam of division.teams) {
          const teamRef = teamMap.get(groupTeam.id);
          if (!teamRef) continue;

          // Fetch team detail for venue/stadium
          let stadium = "";
          try {
            const detail = await fetchJson<EspnTeamDetailResponse>(
              TEAM_DETAIL_URL(groupTeam.id),
            );
            stadium = detail.team.franchise?.venue?.fullName ?? "";
          } catch {
            // Non-fatal — proceed without stadium
          }

          // Fetch roster
          let players: LeagueImportPayload["divisions"][number]["teams"][number]["players"] =
            [];
          try {
            const rosterData = await fetchJson<EspnRosterResponse>(
              ROSTER_URL(groupTeam.id),
            );
            players = rosterData.athletes.flatMap((group) =>
              group.items.map((athlete) => ({
                name: athlete.fullName,
                position: athlete.position.abbreviation,
                jerseyNumber: athlete.jersey ? parseInt(athlete.jersey, 10) : null,
                dateOfBirth: athlete.dateOfBirth
                  ? athlete.dateOfBirth.split("T")[0]
                  : null,
                status: athlete.status?.name ?? "Active",
                headshotUrl: athlete.headshot?.href ?? null,
              })),
            );
          } catch {
            // Non-fatal — team added with empty roster
          }

          teams.push({
            name: teamRef.displayName,
            city: teamRef.location,
            stadium,
            logoUrl: teamRef.logos?.[0]?.href ?? null,
            players,
          });

          await sleep(DELAY_MS);
        }

        divisions.push({ name: divisionName, teams });
      }
    }

    return {
      league: { name: "NFL" },
      divisions,
    };
  }
}
