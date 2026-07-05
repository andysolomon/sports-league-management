import type { FixtureDto, SeasonDto } from "@sports-management/shared-types";

/** True when roster edits / synthetic generation should be blocked for a season. */
export function isSeasonStarted(
  season: SeasonDto,
  fixtures: FixtureDto[],
): boolean {
  if (season.rosterLocked) return true;
  return fixtures.some((f) => f.status === "final");
}
