import {
  dashboardEntryPath,
  leagueDirectoryHref,
  settingsHomeHref,
} from "@/components/workspace/resource-navigation";

/**
 * Canonical shell destinations shared by the desktop/mobile sidebar and the
 * ⌘K command palette (ASR-4, ASR-13, ASR-23): Overview / Teams / Players /
 * Seasons / Settings. Import and Billing moved under Settings → Account (#576).
 */
export interface ShellNavDestination {
  id: string;
  label: string;
  href: string;
  /** Hidden from the sidebar when the operator has no leagues (ASR-22). */
  hideWithoutLeague?: boolean;
}

/** Destinations for the desktop/mobile sidebar rail. */
export function buildShellNavItems(
  activeLeagueId: string | null,
): ShellNavDestination[] {
  return [
    {
      id: "overview",
      label: "Overview",
      href: dashboardEntryPath(activeLeagueId),
      hideWithoutLeague: true,
    },
    {
      id: "teams",
      label: "Teams",
      href: "/dashboard/teams",
      hideWithoutLeague: true,
    },
    {
      id: "players",
      label: "Players",
      href: "/dashboard/players",
      hideWithoutLeague: true,
    },
    {
      id: "seasons",
      label: "Seasons",
      href: "/dashboard/seasons",
      hideWithoutLeague: true,
    },
    // No hideWithoutLeague: Account Settings must stay reachable for
    // operators with zero leagues (ASR-22).
    { id: "settings", label: "Settings", href: settingsHomeHref() },
  ];
}

/**
 * Command palette Navigate group (ASR-23). Same shell destinations as the
 * sidebar, plus League Directory as the explicit cross-league command.
 * Obsolete standalone Leagues / Divisions / Discover / Roles are omitted.
 */
export function buildPaletteNavItems(
  activeLeagueId: string | null,
): ShellNavDestination[] {
  const shell = buildShellNavItems(activeLeagueId);
  const overview = shell[0];
  const rest = shell.slice(1);
  return [
    overview,
    {
      id: "league-directory",
      label: "League Directory",
      href: leagueDirectoryHref(),
    },
    ...rest,
  ];
}
