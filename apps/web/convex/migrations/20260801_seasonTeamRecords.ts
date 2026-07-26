import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  buildTeamRecord,
  serializeHeadToHead,
  type TeamGameOutcome,
} from "../lib/teamRecords";

/*
 * Backfill `seasonTeamRecords` for seasons that already have results (F2).
 *
 * Standings read the cache, so a season with played games but no record rows
 * would render as all-zeroes until its next result write. This populates them.
 *
 * ONE SEASON PER INVOCATION, deliberately. A whole-league backfill would read
 * every fixture and result across every season in a single transaction and can
 * exceed Convex's 8192-document query ceiling on a long-running dynasty. Call
 * it per season:
 *
 *   npx convex run migrations/20260801_seasonTeamRecords:backfillSeasonTeamRecords \
 *     '{"seasonId":"<id>"}'
 *
 * Idempotent: it rebuilds from source and replaces, so re-running is a no-op.
 * This is also the manual repair path if a record is ever suspected of drift.
 */

const LAST_RESULTS_CAP = 10;

export const backfillSeasonTeamRecords = internalMutation({
  args: { seasonId: v.id("seasons") },
  returns: v.object({
    teamsWritten: v.number(),
    gamesCounted: v.number(),
  }),
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) return { teamsWritten: 0, gamesCounted: 0 };

    const [teams, fixtures] = await Promise.all([
      ctx.db
        .query("teams")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
        .collect(),
      ctx.db
        .query("fixtures")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
        .collect(),
    ]);

    const divisionByTeam = new Map<string, string | null>(
      teams.map((t) => [t._id as string, t.divisionId ?? null]),
    );

    // Same ordering rule the runtime rebuild uses, so a backfilled row is
    // byte-identical to one produced by recording the games in sequence.
    const counted = fixtures
      .filter((f) => f.status === "final" && f.stage !== "playoff")
      .sort((a, b) => {
        const aWeek = a.week ?? Number.MAX_SAFE_INTEGER;
        const bWeek = b.week ?? Number.MAX_SAFE_INTEGER;
        if (aWeek !== bWeek) return aWeek - bWeek;
        const aAt = a.scheduledAt ?? "";
        const bAt = b.scheduledAt ?? "";
        if (aAt !== bAt) return aAt < bAt ? -1 : 1;
        return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
      });

    const outcomesByTeam = new Map<string, TeamGameOutcome[]>();
    let gamesCounted = 0;

    for (const fixture of counted) {
      const result = await ctx.db
        .query("gameResults")
        .withIndex("by_fixtureId", (q) => q.eq("fixtureId", fixture._id))
        .first();
      if (!result) continue;
      gamesCounted += 1;

      const homeDivision = divisionByTeam.get(fixture.homeTeamId as string) ?? null;
      const awayDivision = divisionByTeam.get(fixture.awayTeamId as string) ?? null;
      const sameDivision = homeDivision !== null && homeDivision === awayDivision;

      const push = (teamId: string, outcome: TeamGameOutcome) => {
        const list = outcomesByTeam.get(teamId) ?? [];
        list.push(outcome);
        outcomesByTeam.set(teamId, list);
      };

      push(fixture.homeTeamId as string, {
        opponentTeamId: fixture.awayTeamId as string,
        teamScore: result.homeScore,
        opponentScore: result.awayScore,
        sameDivision,
      });
      push(fixture.awayTeamId as string, {
        opponentTeamId: fixture.homeTeamId as string,
        teamScore: result.awayScore,
        opponentScore: result.homeScore,
        sameDivision,
      });
    }

    const now = new Date().toISOString();
    let teamsWritten = 0;

    for (const team of teams) {
      const built = buildTeamRecord({
        teamId: team._id as string,
        divisionId: team.divisionId ?? null,
        outcomes: outcomesByTeam.get(team._id as string) ?? [],
      });

      const existingEmpty = await ctx.db
        .query("seasonTeamRecords")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", args.seasonId).eq("teamId", team._id as Id<"teams">),
        )
        .first();

      // Match the runtime rebuild: a team with no counted games gets no row,
      // so a backfill produces exactly the row set incremental maintenance
      // would have. Standings default a missing row to 0-0-0.
      if (built.gamesCounted === 0) {
        if (existingEmpty) await ctx.db.delete(existingEmpty._id);
        continue;
      }

      const payload = {
        leagueId: season.leagueId,
        seasonId: args.seasonId,
        teamId: team._id,
        divisionId: team.divisionId ?? null,
        wins: built.wins,
        losses: built.losses,
        ties: built.ties,
        pointsFor: built.pointsFor,
        pointsAgainst: built.pointsAgainst,
        divisionWins: built.divisionWins,
        divisionLosses: built.divisionLosses,
        divisionTies: built.divisionTies,
        headToHeadJson: serializeHeadToHead(built.headToHead),
        streak: built.streak,
        lastResults: built.lastResults.slice(0, LAST_RESULTS_CAP) as string[],
        gamesCounted: built.gamesCounted,
        updatedAt: now,
      };

      const existing = await ctx.db
        .query("seasonTeamRecords")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", args.seasonId).eq("teamId", team._id as Id<"teams">),
        )
        .first();

      if (existing) {
        await ctx.db.replace(existing._id, payload);
      } else {
        await ctx.db.insert("seasonTeamRecords", payload);
      }
      teamsWritten += 1;
    }

    return { teamsWritten, gamesCounted };
  },
});
