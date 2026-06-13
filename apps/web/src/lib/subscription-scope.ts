import type { OrgContext } from "./org-context";

/**
 * À la carte import filters (WSM-000100). When the user imported only some
 * teams from a league, the Teams/Players *lists* show just those teams. A
 * league with no scope entry means "import all" → no filtering. This is a
 * display filter only; team/player detail and standings stay fully reachable.
 */
export function teamsInScope<T extends { id: string }>(
  teams: T[],
  leagueId: string,
  orgContext: OrgContext,
): T[] {
  const scope = orgContext.subscriptionTeamScopes[leagueId];
  if (!scope || scope.length === 0) return teams;
  const allowed = new Set(scope);
  return teams.filter((team) => allowed.has(team.id));
}

export function playersInScope<T extends { teamId: string }>(
  players: T[],
  leagueId: string,
  orgContext: OrgContext,
): T[] {
  const scope = orgContext.subscriptionTeamScopes[leagueId];
  if (!scope || scope.length === 0) return players;
  const allowed = new Set(scope);
  return players.filter((player) => allowed.has(player.teamId));
}
