/**
 * Pure URL builders for the dashboard Resource Header system (WSM-000571,
 * ASR-7). Each function returns canonical Home or sibling URLs without
 * touching data: callers must already have authorized the resource, and
 * the Resource Header itself is presentation-only (no fetches).
 *
 * `?season=` is preserved on legacy League competition URLs until
 * issue #575 moves them under Season Home.
 */
export type ResourceHeaderKind = "league" | "team" | "player" | "season";

export interface ResourceSiblingLink {
  label: string;
  href: string;
}

export function leagueHomeHref(leagueId: string): string {
  return `/dashboard/leagues/${leagueId}`;
}

export function teamHomeHref(teamId: string): string {
  return `/dashboard/teams/${teamId}`;
}

export function playerHomeHref(playerId: string): string {
  return `/dashboard/players/${playerId}`;
}

export function seasonHomeHref(seasonId: string): string {
  return `/dashboard/seasons/${seasonId}`;
}

/**
 * Builds the canonical sub-page URL for a League, preserving the legacy
 * `?season=` query parameter when an active season is supplied. ASR-3
 * moves these routes under Season Home in #575.
 */
export function leagueSubpageHref(
  leagueId: string,
  subpage: "schedule" | "standings" | "playoffs" | "stats" | "manage",
  activeSeasonId: string | null,
): string {
  const query = activeSeasonId ? `?season=${activeSeasonId}` : "";
  return `/dashboard/leagues/${leagueId}/${subpage}${query}`;
}

export function teamSubpageHref(
  teamId: string,
  subpage: "roster" | "roster/audit" | "depth-chart",
): string {
  return `/dashboard/teams/${teamId}/${subpage}`;
}

export function playerSubpageHref(
  playerId: string,
  subpage: "development",
): string {
  return `/dashboard/players/${playerId}/${subpage}`;
}

/**
 * Sibling links shown in the Resource Header for a Team Home. Feature flags
 * gate Roster (`rosterSnapshotsV1`) and Depth Chart (`depthChartV1`).
 */
export function buildTeamSiblingLinks({
  teamId,
  rosterEnabled,
  depthChartEnabled,
}: {
  teamId: string;
  rosterEnabled: boolean;
  depthChartEnabled: boolean;
}): ResourceSiblingLink[] {
  const links: (ResourceSiblingLink | false)[] = [
    { label: "Overview", href: teamHomeHref(teamId) },
    rosterEnabled && {
      label: "Roster",
      href: teamSubpageHref(teamId, "roster"),
    },
    depthChartEnabled && {
      label: "Depth chart",
      href: teamSubpageHref(teamId, "depth-chart"),
    },
  ];
  return links.filter((link): link is ResourceSiblingLink => Boolean(link));
}

export function buildPlayerSiblingLinks({
  playerId,
  developmentEnabled,
}: {
  playerId: string;
  developmentEnabled: boolean;
}): ResourceSiblingLink[] {
  const links: (ResourceSiblingLink | false)[] = [
    { label: "Overview", href: playerHomeHref(playerId) },
    developmentEnabled && {
      label: "Development",
      href: playerSubpageHref(playerId, "development"),
    },
  ];
  return links.filter((link): link is ResourceSiblingLink => Boolean(link));
}

export function buildSeasonSiblingLinks({
  seasonId,
  leagueId,
  activeSeasonId,
  scheduleEnabled,
  playoffsEnabled,
  statsEnabled,
}: {
  seasonId: string;
  leagueId: string;
  activeSeasonId: string | null;
  scheduleEnabled: boolean;
  playoffsEnabled: boolean;
  statsEnabled: boolean;
}): ResourceSiblingLink[] {
  const query = activeSeasonId ? `?season=${activeSeasonId}` : "";
  const links: (ResourceSiblingLink | false)[] = [
    { label: "Overview", href: seasonHomeHref(seasonId) },
    scheduleEnabled && {
      label: "Schedule",
      href: `/dashboard/leagues/${leagueId}/schedule${query}`,
    },
    scheduleEnabled && {
      label: "Standings",
      href: `/dashboard/leagues/${leagueId}/standings${query}`,
    },
    playoffsEnabled && {
      label: "Playoffs",
      href: `/dashboard/leagues/${leagueId}/playoffs${query}`,
    },
    statsEnabled && {
      label: "Stat leaders",
      href: `/dashboard/leagues/${leagueId}/stats${query}`,
    },
  ];
  return links.filter((link): link is ResourceSiblingLink => Boolean(link));
}

/**
 * Determines whether the active sibling should be highlighted.
 * Uses a `pathname` comparison so it works with Next.js route segments and
 * ignores trailing slashes / search params.
 */
export function isActiveHref(
  currentPath: string | null | undefined,
  siblingHref: string,
): boolean {
  if (!currentPath) return false;
  const [path] = siblingHref.split("?");
  if (!path) return false;
  return currentPath === path || currentPath.startsWith(`${path}/`);
}