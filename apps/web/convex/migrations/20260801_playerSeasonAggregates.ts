import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { parseStatLine, summarizeStatLines } from "../lib/playerStats";

/*
 * Backfill `playerSeasonAggregates` for seasons with existing stat lines (F3).
 *
 * Stat leaders and SPRT now read the aggregate, so a season whose box scores
 * predate this table would show an empty leaderboard until each player's next
 * stat write. This populates it.
 *
 * ONE SEASON PER INVOCATION, deliberately: a whole-league backfill would read
 * every `playerGameStats` row across every season in one transaction and can
 * exceed Convex's 8192-document query ceiling on a long dynasty. A single
 * season is ~600 rows for a 12-team league, ~1900 for a 32-team league.
 *
 *   npx convex run migrations/20260801_playerSeasonAggregates:backfillPlayerSeasonAggregates \
 *     '{"seasonId":"<id>"}'
 *
 * Idempotent — it rebuilds from source and replaces.
 */
export const backfillPlayerSeasonAggregates = internalMutation({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    playersWritten: v.number(),
    linesCounted: v.number(),
  }),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) return { playersWritten: 0, linesCounted: 0 };

    const rows = await ctx.db
      .query("playerGameStats")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();

    // Group in memory rather than one indexed read per player: the backfill
    // already holds every row, so per-player reads would be pure waste.
    const byPlayer = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byPlayer.get(row.playerId as string) ?? [];
      list.push(row);
      byPlayer.set(row.playerId as string, list);
    }

    const now = new Date().toISOString();
    let playersWritten = 0;

    for (const [playerId, playerRows] of byPlayer) {
      const player = await ctx.db.get(playerId as Id<"players">);
      if (!player) continue;

      const { totals, gamesPlayed } = summarizeStatLines(
        playerRows.map((r) => parseStatLine(r.statsJson)),
      );

      const payload = {
        leagueId: season.leagueId,
        seasonId: args.seasonId,
        teamId: playerRows[playerRows.length - 1]!.teamId,
        playerId: playerId as Id<"players">,
        position: player.position,
        positionGroup: player.positionGroup ?? null,
        gamesPlayed,
        totalsJson: JSON.stringify(totals),
        updatedAt: now,
      };

      const existing = await ctx.db
        .query("playerSeasonAggregates")
        .withIndex("by_playerId_seasonId", (q) =>
          q
            .eq("playerId", playerId as Id<"players">)
            .eq("seasonId", args.seasonId),
        )
        .first();

      if (existing) {
        await ctx.db.replace(existing._id, payload);
      } else {
        await ctx.db.insert("playerSeasonAggregates", payload);
      }
      playersWritten += 1;
    }

    return { playersWritten, linesCounted: rows.length };
  },
});
