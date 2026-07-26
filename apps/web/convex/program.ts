import { query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";

/*
 * Dynasty Mode — program management (Epic C).
 *
 * Home for coaches and staff, program prestige, season goals, job security,
 * team schemes and the coach skill tree. Empty in F1 beyond the readiness probe.
 *
 * ## Rules
 *
 * 1. Every WRITE is an `internalMutation` (WSM-000096); the guard test's
 *    `AllowedPublicProgramReads` backstop fails `tsc` if one leaks.
 * 2. Every function declares a `returns:` validator (WSM-000166).
 * 3. Season finalization hooks (goal evaluation, prestige, coach-season
 *    rollup) read ONLY the persisted `seasonTeamRecords` and
 *    `playerSeasonAggregates` from Epic F — never `playerGameStats` or
 *    `fixtures` directly. That restriction is what stops Epic C from
 *    reintroducing the N+1 read pattern F2/F3 exist to remove.
 * 4. `coaches.userId` and its `by_userId` index exist from the first slice, so
 *    a coach can later be bound to a real user without a migration.
 */

/** Module readiness probe — see `lib/moduleStatus.ts` for why this exists. */
export const moduleStatus = query({
  args: {},
  returns: moduleStatusValidator,
  handler: async () => ({
    module: DYNASTY_MODULES.program,
    epic: "C",
    ready: true,
  }),
});
