import { query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";

/*
 * Dynasty Mode — history, awards and narrative (Epic D).
 *
 * Home for career totals, program record books, awards, the Hall of Fame,
 * weekly polls, the dynasty news feed and season recaps. Empty in F1 beyond the
 * readiness probe.
 *
 * ## Rules
 *
 * 1. Every WRITE is an `internalMutation` (WSM-000096); the guard test's
 *    `AllowedPublicHistoryReads` backstop fails `tsc` if one leaks.
 * 2. Every function declares a `returns:` validator (WSM-000166).
 * 3. NEVER scan `playerGameStats` or `gamePlayLogs` for history. The layering
 *    is playerGameStats → playerSeasonAggregates (F3, incremental) →
 *    playerCareerTotals (materialized at `completeSeason`). `finalizeSeason-
 *    History` reads one indexed batch of aggregates plus ~12 team records.
 * 4. Narrative copy renders HERE, from deterministic templates in
 *    `lib/narrative.ts`, so user-facing headlines have one source of truth and
 *    stay unit-testable. No model-generated prose.
 * 5. If a league ever exceeds the 8192-document query ceiling, split the work
 *    by team using the EXISTING `seasonRollovers` lease/stage pattern rather
 *    than inventing a second concurrency idiom.
 */

/** Module readiness probe — see `lib/moduleStatus.ts` for why this exists. */
export const moduleStatus = query({
  args: {},
  returns: moduleStatusValidator,
  handler: async () => ({
    module: DYNASTY_MODULES.history,
    epic: "D",
    ready: true,
  }),
});
