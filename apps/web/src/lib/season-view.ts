import type { SeasonDto } from "@sports-management/shared-types";

/*
 * Viewed-season resolution for league-scoped pages (WSM-000214).
 *
 * Schedule / standings / stats / playoffs historically hard-wired the ACTIVE
 * season, which made finished seasons unreachable the moment a new one was
 * activated. These pages now accept `?season=<id>`: a valid id belonging to
 * the league wins; anything else falls back to the old behavior
 * (active season, then upcoming season, then the most recent one).
 */
export function resolveLifecycleSeason(seasons: SeasonDto[]): SeasonDto | null {
  const newest = (eligible: SeasonDto[]) =>
    [...eligible].sort((a, b) => {
      const aDate = a.startDate ?? a.endDate ?? "";
      const bDate = b.startDate ?? b.endDate ?? "";
      return (
        bDate.localeCompare(aDate) ||
        b.name.localeCompare(a.name) ||
        b.id.localeCompare(a.id)
      );
    })[0] ?? null;

  return (
    newest(seasons.filter((season) => season.status === "active")) ??
    newest(seasons.filter((season) => season.status === "upcoming")) ??
    newest(seasons)
  );
}

export function resolveViewedSeason(
  seasons: SeasonDto[],
  seasonParam: string | undefined,
): SeasonDto | null {
  if (seasonParam) {
    const requested = seasons.find((s) => s.id === seasonParam);
    if (requested) return requested;
  }
  return resolveLifecycleSeason(seasons);
}
