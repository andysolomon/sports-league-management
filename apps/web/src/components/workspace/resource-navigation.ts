/**
 * Pure URL builders for the dashboard Resource Header system (WSM-000571,
 * ASR-7). Each function returns canonical Home or sibling URLs without
 * touching data: callers must already have authorized the resource, and
 * the Resource Header itself is presentation-only (no fetches).
 *
 * Competition views (schedule / standings / playoffs / stats) are Season-owned
 * (`/dashboard/seasons/<id>/<subpage>`) as of issue #575; the legacy
 * League-owned URLs now permanently redirect to these.
 */
export type ResourceHeaderKind = "league" | "team" | "player" | "season";

export interface ResourceSiblingLink {
  label: string;
  href: string;
}

export function leagueHomeHref(leagueId: string): string {
  return `/dashboard/leagues/${leagueId}`;
}

export function leagueDirectoryHref(): string {
  return "/dashboard/leagues";
}

/**
 * Resolves where `/dashboard` should redirect (ASR-21/22/10).
 * Active League present → League Home; otherwise League Directory onboarding.
 */
export function dashboardEntryPath(activeLeagueId: string | null): string {
  if (activeLeagueId) {
    return leagueHomeHref(activeLeagueId);
  }
  return leagueDirectoryHref();
}

/**
 * League Directory row primary action (ASR-1). Persists the League as Active
 * via the access-validated `/dashboard/active-league` handler before League Home.
 */
export function leagueActivationHref(leagueId: string): string {
  const returnTo = leagueHomeHref(leagueId);
  const params = new URLSearchParams({ leagueId, returnTo });
  return `/dashboard/active-league?${params.toString()}`;
}

/**
 * Active Season shortcut from League Directory or League Home (ASR-9).
 * Routes through the access-validated `/dashboard/active-league` handler so
 * the owning League is persisted as Active before Season Home renders.
 */
export function activeSeasonShortcutHref(
  leagueId: string,
  seasonId: string,
): string {
  const returnTo = `/dashboard/seasons/${seasonId}`;
  const params = new URLSearchParams({ leagueId, returnTo });
  return `/dashboard/active-league?${params.toString()}`;
}

/**
 * Settings Home (issue #576, ASR-8). Branches to League Settings (Org Admin
 * of the Active League) and Account Settings; always available, even with no
 * leagues (ASR-22), so it must never be hidden behind `hideWithoutLeague`.
 */
export function settingsHomeHref(): string {
  return "/dashboard/settings";
}

/** League Settings for the Active League (Org Admin only — ASR-11). */
export function leagueSettingsHref(): string {
  return "/dashboard/settings/league";
}

/** Account Settings hub; owns Import and Billing (ASR-8). */
export function accountSettingsHref(): string {
  return "/dashboard/settings/account";
}

/** Cross-league Import under Account Settings (payload owns league identity). */
export function accountImportHref(): string {
  return "/dashboard/settings/account/import";
}

/** User-scoped Billing under Account Settings. */
export function accountBillingHref(): string {
  return "/dashboard/settings/account/billing";
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
 * Canonical sub-page URL for a Season Home child route (ASR-3).
 */
export function seasonSubpageHref(
  seasonId: string,
  subpage: "schedule" | "standings" | "playoffs" | "stats",
): string {
  return `/dashboard/seasons/${seasonId}/${subpage}`;
}

/**
 * Legacy League sub-page URL. Competition views (schedule / standings /
 * playoffs / stats) now live under Season Home and these URLs only remain
 * as redirect sources (ASR-15).
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
  scheduleEnabled,
  playoffsEnabled,
  statsEnabled,
}: {
  seasonId: string;
  scheduleEnabled: boolean;
  playoffsEnabled: boolean;
  statsEnabled: boolean;
}): ResourceSiblingLink[] {
  const links: (ResourceSiblingLink | false)[] = [
    { label: "Overview", href: seasonHomeHref(seasonId) },
    scheduleEnabled && {
      label: "Schedule",
      href: seasonSubpageHref(seasonId, "schedule"),
    },
    scheduleEnabled && {
      label: "Standings",
      href: seasonSubpageHref(seasonId, "standings"),
    },
    playoffsEnabled && {
      label: "Playoffs",
      href: seasonSubpageHref(seasonId, "playoffs"),
    },
    statsEnabled && {
      label: "Stat leaders",
      href: seasonSubpageHref(seasonId, "stats"),
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