export type LeagueSubpage = "schedule" | "standings" | "playoffs" | "stats";

/**
 * Flag-gated peer links for a league's competition views (WSM-000236, #575).
 *
 * When a season is in context these are the canonical Season-owned routes
 * (`/dashboard/seasons/<id>/<subpage>`, no `?season=`). With no active season
 * the links fall back to the legacy League-owned paths, which redirect
 * (resolving/activating the League) once followed.
 */
export function buildLeagueSeasonNavLinks({
  leagueId,
  seasonId,
  scheduleEnabled,
  playoffsEnabled,
  statsEnabled,
  exclude,
}: {
  leagueId: string;
  seasonId: string | null;
  scheduleEnabled: boolean;
  playoffsEnabled: boolean;
  statsEnabled: boolean;
  exclude?: LeagueSubpage;
}): { label: string; href: string }[] {
  const href = (subpage: LeagueSubpage) =>
    seasonId
      ? `/dashboard/seasons/${seasonId}/${subpage}`
      : `/dashboard/leagues/${leagueId}/${subpage}`;

  return [
    scheduleEnabled &&
      exclude !== "schedule" && {
        href: href("schedule"),
        label: "Schedule",
      },
    scheduleEnabled &&
      exclude !== "standings" && {
        href: href("standings"),
        label: "Standings",
      },
    playoffsEnabled &&
      exclude !== "playoffs" && {
        href: href("playoffs"),
        label: "Playoffs",
      },
    statsEnabled &&
      exclude !== "stats" && {
        href: href("stats"),
        label: "Stat leaders",
      },
  ].filter((link): link is { label: string; href: string } => Boolean(link));
}
