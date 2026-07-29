import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  computePowerRankings,
  type PowerRanking,
  type PreviousPowerRanking,
} from "./powerRankings";

export interface WeeklyPollWriteResult {
  rankings: number;
  written: boolean;
}

function parsePreviousRankings(json: string | null): PreviousPowerRanking[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row): PreviousPowerRanking[] => {
      if (
        !row ||
        typeof row !== "object" ||
        typeof (row as { teamId?: unknown }).teamId !== "string" ||
        typeof (row as { rank?: unknown }).rank !== "number"
      ) {
        return [];
      }
      return [
        {
          teamId: (row as { teamId: string }).teamId,
          rank: (row as { rank: number }).rank,
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * Materialize one week's poll from the persisted F2 cache.
 *
 * The only competition source read here is seasonTeamRecords. In particular,
 * this never touches fixtures or results: one indexed collect yields roughly
 * one document per team, plus the prior poll needed for damping.
 */
export async function computeWeeklyPollForSeason(
  ctx: MutationCtx,
  args: {
    leagueId: Id<"leagues">;
    seasonId: Id<"seasons">;
    week: number;
  },
): Promise<WeeklyPollWriteResult> {
  const records = await ctx.db
    .query("seasonTeamRecords")
    .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
    .collect();
  const leagueRecords = records.filter(
    (record) => record.leagueId === args.leagueId,
  );
  if (leagueRecords.length === 0) {
    return { rankings: 0, written: false };
  }

  const previousPoll =
    args.week > 1
      ? await ctx.db
          .query("weeklyPolls")
          .withIndex("by_seasonId_week", (q) =>
            q.eq("seasonId", args.seasonId).eq("week", args.week - 1),
          )
          .unique()
      : null;
  const rankings: PowerRanking[] = computePowerRankings(
    leagueRecords.map((record) => ({
      teamId: record.teamId,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      pointsFor: record.pointsFor,
      pointsAgainst: record.pointsAgainst,
      headToHeadJson: record.headToHeadJson,
      lastResults: record.lastResults,
      gamesCounted: record.gamesCounted,
    })),
    parsePreviousRankings(previousPoll?.rankingsJson ?? null),
  );
  const rankingsJson = JSON.stringify(rankings);
  const publishedAt = new Date().toISOString();
  const existing = await ctx.db
    .query("weeklyPolls")
    .withIndex("by_seasonId_week", (q) =>
      q.eq("seasonId", args.seasonId).eq("week", args.week),
    )
    .unique();
  const payload = {
    leagueId: args.leagueId,
    seasonId: args.seasonId,
    week: args.week,
    rankingsJson,
    publishedAt,
  };
  if (existing) {
    await ctx.db.replace(existing._id, payload);
  } else {
    await ctx.db.insert("weeklyPolls", payload);
  }
  return { rankings: rankings.length, written: true };
}
