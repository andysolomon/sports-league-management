import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type SeasonLike = {
  _id: Id<"seasons">;
  status: string;
  _creationTime: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

function compareNewestSeason<T extends SeasonLike>(a: T, b: T): number {
  const aDate = a.startDate ?? a.endDate ?? "";
  const bDate = b.startDate ?? b.endDate ?? "";
  return (
    bDate.localeCompare(aDate) ||
    b.name.localeCompare(a.name) ||
    String(b._id).localeCompare(String(a._id))
  );
}

/** Deterministically choose the newest season from an eligible set. */
export function selectNewestSeason<T extends SeasonLike>(
  seasons: readonly T[],
): T | null {
  return [...seasons].sort(compareNewestSeason)[0] ?? null;
}

/** The shared lifecycle fallback: active, newest upcoming, then most recent. */
export function selectLifecycleSeason<T extends SeasonLike>(
  seasons: readonly T[],
): T | null {
  return selectNewestSeason(seasons.filter((s) => s.status === "active")) ??
    selectNewestSeason(seasons.filter((s) => s.status === "upcoming")) ??
    selectNewestSeason(seasons);
}

type DbCtx = Pick<MutationCtx | QueryCtx, "db">;

/** Central competition-state gate. Historical-media annotations do not use it. */
export async function assertSeasonWritable(
  ctx: DbCtx,
  seasonId: Id<"seasons">,
) {
  const season = await ctx.db.get(seasonId);
  if (!season) throw new Error("season_not_found");
  if (season.status === "completed") throw new Error("season_completed");
  return season;
}

export async function assertFixtureSeasonWritable(
  ctx: DbCtx,
  fixtureId: Id<"fixtures">,
) {
  const fixture = await ctx.db.get(fixtureId);
  if (!fixture) throw new Error("fixture_not_found");
  await assertSeasonWritable(ctx, fixture.seasonId);
  return fixture;
}
