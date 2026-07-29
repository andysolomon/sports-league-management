import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

/*
 * Backfill AI head coaches for leagues that predate C1 (Dynasty Mode C1).
 *
 * Idempotent per team: `seedAiHeadCoachesForLeague` skips any team that already
 * has a head coach. Run for one league:
 *
 *   npx convex run migrations/20260729_seedAiHeadCoaches:seedLeague \
 *     '{"leagueId":"<id>"}'
 *
 * Or scan every league:
 *
 *   npx convex run migrations/20260729_seedAiHeadCoaches:seedAllLeagues
 */

export const seedLeague = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.object({
    coachesCreated: v.number(),
    coachSeasonsCreated: v.number(),
    teamsScanned: v.number(),
  }),
  /*
   * The return type is annotated rather than inferred. Inferring it would make
   * this module's entry in the generated `api` depend on `internal.program`,
   * which is itself read off `api` — a cycle TypeScript resolves to `any`,
   * poisoning every `Exclude<keyof typeof api.X, …>` guard in the codebase.
   * `pnpm turbo type-check` cannot see it because it reads the checked-in
   * `_generated/api.d.ts`; only `convex deploy`'s regenerated types expose it.
   */
  handler: async (
    ctx,
    args,
  ): Promise<{
    coachesCreated: number;
    coachSeasonsCreated: number;
    teamsScanned: number;
  }> => {
    return ctx.runMutation(internal.program.seedAiHeadCoachesForLeague, {
      leagueId: args.leagueId,
    });
  },
});

export const seedAllLeagues = internalMutation({
  args: {},
  returns: v.object({
    leaguesScanned: v.number(),
    coachesCreated: v.number(),
    coachSeasonsCreated: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    leaguesScanned: number;
    coachesCreated: number;
    coachSeasonsCreated: number;
  }> => {
    const leagues = await ctx.db.query("leagues").collect();
    let coachesCreated = 0;
    let coachSeasonsCreated = 0;
    for (const league of leagues) {
      const result = await ctx.runMutation(
        internal.program.seedAiHeadCoachesForLeague,
        { leagueId: league._id },
      );
      coachesCreated += result.coachesCreated;
      coachSeasonsCreated += result.coachSeasonsCreated;
    }
    return {
      leaguesScanned: leagues.length,
      coachesCreated,
      coachSeasonsCreated,
    };
  },
});
