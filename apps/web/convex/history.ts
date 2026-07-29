import { v, type Infer } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";
import {
  RECORD_CATEGORY_LABELS,
} from "./lib/records";
import {
  finalizeSeasonHistoryForSeason,
  type FinalizeSeasonHistoryResult,
} from "./lib/historyFinalize";

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

const finalizeSeasonHistoryResultValidator = v.object({
  careerTotalsUpdated: v.number(),
  recordsUpdated: v.number(),
  recordsBroken: v.number(),
});

export const finalizeSeasonHistory = internalMutation({
  args: { seasonId: v.id("seasons") },
  returns: finalizeSeasonHistoryResultValidator,
  handler: async (ctx, args): Promise<FinalizeSeasonHistoryResult> =>
    finalizeSeasonHistoryForSeason(ctx, args.seasonId),
});

const careerTotalsDtoValidator = v.object({
  playerId: v.string(),
  totalsJson: v.string(),
  updatedAt: v.string(),
});
type CareerTotalsDto = Infer<typeof careerTotalsDtoValidator>;

export const getCareerTotals = query({
  args: { playerId: v.id("players") },
  returns: v.union(careerTotalsDtoValidator, v.null()),
  handler: async (ctx, args): Promise<CareerTotalsDto | null> => {
    const row = await ctx.db
      .query("playerCareerTotals")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .unique();
    return row
      ? {
          playerId: row.playerId,
          totalsJson: row.totalsJson,
          updatedAt: row.updatedAt,
        }
      : null;
  },
});

const programRecordDtoValidator = v.object({
  id: v.string(),
  category: v.string(),
  categoryLabel: v.string(),
  rank: v.number(),
  value: v.number(),
  playerId: v.union(v.string(), v.null()),
  playerName: v.union(v.string(), v.null()),
  teamId: v.string(),
  teamName: v.string(),
  seasonId: v.string(),
  seasonName: v.string(),
});
type ProgramRecordDto = Infer<typeof programRecordDtoValidator>;

export const listProgramRecords = query({
  args: {
    leagueId: v.id("leagues"),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.array(programRecordDtoValidator),
  handler: async (ctx, args): Promise<ProgramRecordDto[]> => {
    const rows = args.teamId
      ? (
          await ctx.db
            .query("programRecords")
            .withIndex("by_teamId_category_rank", (q) =>
              q.eq("teamId", args.teamId),
            )
            .collect()
        ).filter((row) => row.leagueId === args.leagueId)
      : (
          await ctx.db
            .query("programRecords")
            .withIndex("by_leagueId_category_rank", (q) =>
              q.eq("leagueId", args.leagueId),
            )
            .collect()
        ).filter((row) => row.teamId === undefined);
    if (rows.length === 0) return [];

    const [players, teams, seasons] = await Promise.all([
      ctx.db
        .query("players")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
        .collect(),
      ctx.db
        .query("seasons")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
        .collect(),
    ]);
    const playerNames = new Map(
      players.map((player) => [player._id as string, player.name]),
    );
    const teamNames = new Map(
      teams.map((team) => [team._id as string, team.name]),
    );
    const seasonNames = new Map(
      seasons.map((season) => [season._id as string, season.name]),
    );

    return rows.map((row): ProgramRecordDto => ({
      id: row._id,
      category: row.category,
      categoryLabel:
        RECORD_CATEGORY_LABELS[
          row.category as keyof typeof RECORD_CATEGORY_LABELS
        ] ?? row.category,
      rank: row.rank,
      value: row.value,
      playerId: row.playerId ?? null,
      playerName: row.playerId
        ? (playerNames.get(row.playerId as string) ?? null)
        : null,
      teamId: row.holderTeamId,
      teamName:
        teamNames.get(row.holderTeamId as string) ?? "Unknown program",
      seasonId: row.seasonId,
      seasonName: seasonNames.get(row.seasonId as string) ?? "Unknown season",
    }));
  },
});
