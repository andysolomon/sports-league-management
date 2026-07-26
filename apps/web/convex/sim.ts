import { query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";

/*
 * Dynasty Mode — simulation persistence (Epic A).
 *
 * Home for injury rows, rivalry config and the season-aggregate maintenance
 * hooks the sim path writes through. Empty in F1 beyond the readiness probe.
 *
 * ## Boundary
 *
 * The play-by-play ENGINE stays a pure library in `src/lib/pbp/` and this
 * module never calls it. Sim orchestration stays in the existing Next server
 * actions (`simulateAndPersistFixture` remains the single choke point). This
 * module only persists what a simulated game produced. Keeping the engine free
 * of Convex is what lets the golden-log parity and 200-game distribution tests
 * run as plain unit tests with no database.
 *
 * ## Rules
 *
 * 1. Every WRITE is an `internalMutation` (WSM-000096); the guard test's
 *    `AllowedPublicSimReads` backstop fails `tsc` if one leaks.
 * 2. Every function declares a `returns:` validator (WSM-000166).
 * 3. Stored `gamePlayLogs` rows are IMMUTABLE. Never rewrite a log to migrate
 *    it — readers call `normalizeGameLog` and up-convert in memory.
 */

/** Module readiness probe — see `lib/moduleStatus.ts` for why this exists. */
export const moduleStatus = query({
  args: {},
  returns: moduleStatusValidator,
  handler: async () => ({
    module: DYNASTY_MODULES.sim,
    epic: "A",
    ready: true,
  }),
});
