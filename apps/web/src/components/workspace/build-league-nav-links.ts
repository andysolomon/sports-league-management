export type LeagueSubpage = "schedule" | "standings" | "playoffs" | "stats";

/**
 * Flag-gated peer links for league sub-pages, preserving ?season= (WSM-000236).
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
  const seasonQuery = seasonId ? `?season=${seasonId}` : "";

  return [
    scheduleEnabled &&
      exclude !== "schedule" && {
        href: `/dashboard/leagues/${leagueId}/schedule${seasonQuery}`,
        label: "Schedule",
      },
    scheduleEnabled &&
      exclude !== "standings" && {
        href: `/dashboard/leagues/${leagueId}/standings${seasonQuery}`,
        label: "Standings",
      },
    playoffsEnabled &&
      exclude !== "playoffs" && {
        href: `/dashboard/leagues/${leagueId}/playoffs${seasonQuery}`,
        label: "Playoffs",
      },
    statsEnabled &&
      exclude !== "stats" && {
        href: `/dashboard/leagues/${leagueId}/stats${seasonQuery}`,
        label: "Stat leaders",
      },
  ].filter((link): link is { label: string; href: string } => Boolean(link));
}
