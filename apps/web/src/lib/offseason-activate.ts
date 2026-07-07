/**
 * Activate-season roster warning helpers (WSM-000234).
 * Target size matches convex `DEFAULT_TARGET_ROSTER_SIZE` (48).
 */
export const DEFAULT_TARGET_ROSTER_SIZE = 48;

export interface TeamRosterSize {
  id: string;
  name: string;
  activeCount: number;
}

export interface UndersizedTeam {
  id: string;
  name: string;
  activeCount: number;
  target: number;
}

export function teamsBelowTargetRoster(
  teams: ReadonlyArray<TeamRosterSize>,
  target: number = DEFAULT_TARGET_ROSTER_SIZE,
): UndersizedTeam[] {
  return teams
    .filter((team) => team.activeCount < target)
    .map((team) => ({
      id: team.id,
      name: team.name,
      activeCount: team.activeCount,
      target,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function activateSeasonWarningMessage(
  undersized: ReadonlyArray<UndersizedTeam>,
): string {
  if (undersized.length === 0) return "";
  const target = undersized[0]?.target ?? DEFAULT_TARGET_ROSTER_SIZE;
  const teamLines = undersized
    .map((t) => `${t.name} (${t.activeCount}/${target})`)
    .join(", ");
  return `Some teams are below the target roster size of ${target}: ${teamLines}. You can still activate, but rosters may be incomplete.`;
}
