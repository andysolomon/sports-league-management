import { v, type Infer } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";
import {
  RECORD_CATEGORY_LABELS,
} from "./lib/records";
import { AWARD_LABELS, type AwardType } from "./lib/awards";
import {
  finalizeSeasonHistoryForSeason,
  type FinalizeSeasonHistoryResult,
} from "./lib/historyFinalize";
import { computeWeeklyPollForSeason } from "./lib/weeklyPolls";
import type { PowerRanking } from "./lib/powerRankings";

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

const weeklyPollWriteResultValidator = v.object({
  rankings: v.number(),
  written: v.boolean(),
});
type WeeklyPollWriteDto = Infer<typeof weeklyPollWriteResultValidator>;

export const computeWeeklyPoll = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    week: v.number(),
  },
  returns: weeklyPollWriteResultValidator,
  handler: async (ctx, args): Promise<WeeklyPollWriteDto> => {
    if (!Number.isInteger(args.week) || args.week < 1) {
      throw new Error("invalid_poll_week");
    }
    return computeWeeklyPollForSeason(ctx, args);
  },
});

const weeklyPollRankingDtoValidator = v.object({
  teamId: v.string(),
  teamName: v.string(),
  rank: v.number(),
  previousRank: v.union(v.number(), v.null()),
  points: v.number(),
  record: v.object({
    wins: v.number(),
    losses: v.number(),
    ties: v.number(),
  }),
  trend: v.union(
    v.literal("up"),
    v.literal("down"),
    v.literal("same"),
    v.literal("new"),
  ),
});
const weeklyPollDtoValidator = v.object({
  week: v.number(),
  publishedAt: v.string(),
  rankings: v.array(weeklyPollRankingDtoValidator),
});
type WeeklyPollDto = Infer<typeof weeklyPollDtoValidator>;

function parseRankings(json: string): PowerRanking[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is PowerRanking => {
      if (!row || typeof row !== "object") return false;
      const ranking = row as Partial<PowerRanking>;
      return (
        typeof ranking.teamId === "string" &&
        typeof ranking.rank === "number" &&
        (ranking.previousRank === null ||
          typeof ranking.previousRank === "number") &&
        typeof ranking.points === "number" &&
        Boolean(ranking.record) &&
        typeof ranking.record?.wins === "number" &&
        typeof ranking.record?.losses === "number" &&
        typeof ranking.record?.ties === "number" &&
        (ranking.trend === "up" ||
          ranking.trend === "down" ||
          ranking.trend === "same" ||
          ranking.trend === "new")
      );
    });
  } catch {
    return [];
  }
}

export const getWeeklyPoll = query({
  args: {
    seasonId: v.id("seasons"),
    week: v.optional(v.number()),
  },
  returns: v.union(weeklyPollDtoValidator, v.null()),
  handler: async (ctx, args): Promise<WeeklyPollDto | null> => {
    const requestedWeek = args.week;
    const row =
      requestedWeek !== undefined
        ? await ctx.db
            .query("weeklyPolls")
            .withIndex("by_seasonId_week", (q) =>
              q.eq("seasonId", args.seasonId).eq("week", requestedWeek),
            )
            .unique()
        : await ctx.db
            .query("weeklyPolls")
            .withIndex("by_seasonId_week", (q) =>
              q.eq("seasonId", args.seasonId),
            )
            .order("desc")
            .first();
    if (!row) return null;

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", row.leagueId))
      .collect();
    const teamNames = new Map(
      teams.map((team) => [team._id as string, team.name]),
    );
    return {
      week: row.week,
      publishedAt: row.publishedAt,
      rankings: parseRankings(row.rankingsJson).map(
        (ranking): WeeklyPollDto["rankings"][number] => ({
          ...ranking,
          teamName: teamNames.get(ranking.teamId) ?? "Unknown program",
        }),
      ),
    };
  },
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

const awardDtoValidator = v.object({
  id: v.string(),
  seasonId: v.string(),
  seasonName: v.string(),
  type: v.string(),
  typeLabel: v.string(),
  tier: v.string(),
  playerId: v.union(v.string(), v.null()),
  coachId: v.union(v.string(), v.null()),
  recipientName: v.string(),
  teamId: v.string(),
  teamName: v.string(),
  divisionId: v.union(v.string(), v.null()),
  divisionName: v.union(v.string(), v.null()),
  positionGroup: v.union(v.string(), v.null()),
  scoreValue: v.number(),
});
type AwardDto = Infer<typeof awardDtoValidator>;

async function hydrateAwards(
  ctx: QueryCtx,
  rows: Doc<"awards">[],
): Promise<AwardDto[]> {
  if (rows.length === 0) return [];
  const leagueId = rows[0]!.leagueId;
  const [players, coaches, teams, divisions, seasons] = await Promise.all([
    ctx.db
      .query("players")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .collect(),
    ctx.db
      .query("coaches")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .collect(),
    ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .collect(),
    ctx.db
      .query("divisions")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .collect(),
    ctx.db
      .query("seasons")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .collect(),
  ]);
  const playerNames = new Map(
    players.map((row) => [row._id as string, row.name]),
  );
  const coachNames = new Map(
    coaches.map((row) => [row._id as string, row.displayName]),
  );
  const teamNames = new Map(
    teams.map((row) => [row._id as string, row.name]),
  );
  const divisionNames = new Map(
    divisions.map((row) => [row._id as string, row.name]),
  );
  const seasonNames = new Map(
    seasons.map((row) => [row._id as string, row.name]),
  );

  return rows.map((row): AwardDto => ({
    id: row._id,
    seasonId: row.seasonId,
    seasonName: seasonNames.get(row.seasonId as string) ?? "Unknown season",
    type: row.type,
    typeLabel: AWARD_LABELS[row.type as AwardType] ?? row.type,
    tier: row.tier,
    playerId: row.playerId,
    coachId: row.coachId,
    recipientName: row.playerId
      ? (playerNames.get(row.playerId as string) ?? "Unknown player")
      : row.coachId
        ? (coachNames.get(row.coachId as string) ?? "Unknown coach")
        : "Unknown recipient",
    teamId: row.teamId,
    teamName: teamNames.get(row.teamId as string) ?? "Unknown program",
    divisionId: row.divisionId,
    divisionName: row.divisionId
      ? (divisionNames.get(row.divisionId as string) ?? "Unknown division")
      : null,
    positionGroup: row.positionGroup,
    scoreValue: row.scoreValue,
  }));
}

export const listSeasonAwards = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(awardDtoValidator),
  handler: async (ctx, args): Promise<AwardDto[]> => {
    const rows = await ctx.db
      .query("awards")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();
    return hydrateAwards(ctx, rows);
  },
});

export const listPlayerAwards = query({
  args: { playerId: v.id("players") },
  returns: v.array(awardDtoValidator),
  handler: async (ctx, args): Promise<AwardDto[]> => {
    const rows = await ctx.db
      .query("awards")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .collect();
    return hydrateAwards(ctx, rows);
  },
});

export const listCoachAwards = query({
  args: { coachId: v.id("coaches") },
  returns: v.array(awardDtoValidator),
  handler: async (ctx, args): Promise<AwardDto[]> => {
    const rows = await ctx.db
      .query("awards")
      .withIndex("by_coachId", (q) => q.eq("coachId", args.coachId))
      .collect();
    return hydrateAwards(ctx, rows);
  },
});
