/**
 * Bounded league roster-deficit projection (WSM-000242).
 * Reuses DEFAULT_TARGET_ROSTER_SIZE from offseason-activate.
 */
import {
  DEFAULT_TARGET_ROSTER_SIZE,
  type TeamRosterSize,
  type UndersizedTeam,
} from "@/lib/offseason-activate";

export interface UndersizedTeamWithDeficit extends UndersizedTeam {
  deficit: number;
}

export function withRosterDeficit(team: UndersizedTeam): UndersizedTeamWithDeficit {
  return {
    ...team,
    deficit: team.target - team.activeCount,
  };
}

/** Count active (non-graduated) players per team from a league player list. */
export function activeRosterCountByTeam(
  players: ReadonlyArray<{ teamId: string; status: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const player of players) {
    if (player.status === "graduated") continue;
    counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1);
  }
  return counts;
}

export function buildLeagueRosterDeficitProjection(
  teams: ReadonlyArray<{ id: string; name: string }>,
  countByTeam: ReadonlyMap<string, number>,
  target: number = DEFAULT_TARGET_ROSTER_SIZE,
): { target: number; teams: UndersizedTeamWithDeficit[] } {
  const rosterSizes: TeamRosterSize[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    activeCount: countByTeam.get(team.id) ?? 0,
  }));
  const undersized = rosterSizes
    .filter((team) => team.activeCount < target)
    .map((team) =>
      withRosterDeficit({
        id: team.id,
        name: team.name,
        activeCount: team.activeCount,
        target,
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return { target, teams: undersized };
}

export function undersizedRosterSummaryMessage(
  undersized: ReadonlyArray<UndersizedTeamWithDeficit>,
  target: number,
): string {
  if (undersized.length === 0) return "";
  const teamLines = undersized
    .map((team) => `${team.name} (${team.activeCount}/${target})`)
    .join(", ");
  return `Some teams are below the target roster size of ${target}: ${teamLines}.`;
}
