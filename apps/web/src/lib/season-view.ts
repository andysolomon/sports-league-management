import type { SeasonDto } from "@sports-management/shared-types";

/*
 * Viewed-season resolution for league-scoped pages (WSM-000214).
 *
 * Schedule / standings / stats / playoffs historically hard-wired the ACTIVE
 * season, which made finished seasons unreachable the moment a new one was
 * activated. These pages now accept `?season=<id>`: a valid id belonging to
 * the league wins; anything else falls back to the old behavior
 * (active season, else the first one).
 */
export function resolveViewedSeason(
  seasons: SeasonDto[],
  seasonParam: string | undefined,
): SeasonDto | null {
  if (seasonParam) {
    const requested = seasons.find((s) => s.id === seasonParam);
    if (requested) return requested;
  }
  return seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
}
