/**
 * Pure fixture scheduling rules shared by Convex writes and schedule forms.
 * Keep this module free of Convex imports so both runtimes use identical rules.
 */

export interface WeekFixture {
  id: string;
  week: unknown;
  homeTeamId: string;
  awayTeamId: string;
}

export interface WeekFixtureCandidate {
  week: unknown;
  homeTeamId: string;
  awayTeamId: string;
  excludeFixtureId?: string;
}

/** A schedulable week is a positive integer. */
export function isValidWeek(week: unknown): week is number {
  return typeof week === "number" && Number.isInteger(week) && week > 0;
}

/**
 * Return the candidate team already playing in the requested week, or null
 * when both teams are free. An edited fixture can exclude its own persisted id.
 */
export function findWeekConflict(
  existing: readonly WeekFixture[],
  candidate: WeekFixtureCandidate,
): string | null {
  if (!isValidWeek(candidate.week)) return null;

  for (const fixture of existing) {
    if (fixture.id === candidate.excludeFixtureId) continue;
    if (fixture.week !== candidate.week) continue;

    if (
      fixture.homeTeamId === candidate.homeTeamId ||
      fixture.awayTeamId === candidate.homeTeamId
    ) {
      return candidate.homeTeamId;
    }
    if (
      fixture.homeTeamId === candidate.awayTeamId ||
      fixture.awayTeamId === candidate.awayTeamId
    ) {
      return candidate.awayTeamId;
    }
  }

  return null;
}
