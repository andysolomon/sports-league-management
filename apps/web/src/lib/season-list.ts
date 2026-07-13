import type { SeasonDto } from "@sports-management/shared-types";

/** Extract a sortable year from season metadata (start date preferred). */
export function seasonSortYear(season: Pick<SeasonDto, "name" | "startDate">): number {
  if (season.startDate) {
    const year = new Date(season.startDate).getFullYear();
    if (!Number.isNaN(year)) return year;
  }
  const match = season.name.match(/\b(19|20)\d{2}\b/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

/**
 * Active season first, then descending year (WSM-000255 / prototype SeasonsScreen).
 */
export function sortSeasons<T extends Pick<SeasonDto, "status" | "name" | "startDate">>(
  seasons: ReadonlyArray<T>,
): T[] {
  return [...seasons].sort((a, b) => {
    const aActive = a.status === "active";
    const bActive = b.status === "active";
    if (aActive !== bActive) return aActive ? -1 : 1;
    return seasonSortYear(b) - seasonSortYear(a);
  });
}

export interface SeasonArchiveMeta {
  gamesFinal: number;
  gamesTotal: number;
  seasonDecided: boolean;
  leader: {
    teamName: string;
    wins: number;
    losses: number;
    ties: number;
  } | null;
  champion: { teamName: string | null } | null;
}

export function formatSeasonRecord(wins: number, losses: number, ties: number): string {
  return `${wins}-${losses}${ties ? `-${ties}` : ""}`;
}
