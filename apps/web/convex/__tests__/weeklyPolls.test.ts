/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { computeWeeklyPollForSeason } from "../lib/weeklyPolls";

const modules = import.meta.glob("../**/*.*s");

async function seedRecords(t: ReturnType<typeof convexTest>, count = 12) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Poll League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const seasonId = await ctx.db.insert("seasons", {
      name: "2032",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const teamIds: Id<"teams">[] = [];
    for (let index = 0; index < count; index += 1) {
      const teamId = await ctx.db.insert("teams", {
        name: `Poll Team ${index + 1}`,
        leagueId,
        divisionId: null,
        city: "City",
        stadium: "Stadium",
        foundedYear: null,
        location: "Location",
        logoUrl: null,
        rosterLimit: 53,
      });
      teamIds.push(teamId);
    }
    for (const [index, teamId] of teamIds.entries()) {
      const opponent = teamIds[(index + 1) % teamIds.length]!;
      await ctx.db.insert("seasonTeamRecords", {
        leagueId,
        seasonId,
        teamId,
        divisionId: null,
        wins: count - index,
        losses: index,
        ties: 0,
        pointsFor: 300 - index * 5,
        pointsAgainst: 150 + index * 5,
        divisionWins: 0,
        divisionLosses: 0,
        divisionTies: 0,
        headToHeadJson: JSON.stringify({
          [opponent]: { w: index % 2, l: (index + 1) % 2, t: 0 },
        }),
        streak: 1,
        lastResults: ["W"],
        gamesCounted: count,
        updatedAt: new Date(0).toISOString(),
      });
    }
    return { leagueId, seasonId, teamIds };
  });
}

describe("weekly polls persistence", () => {
  it("reads one indexed team-record batch and never scans fixtures", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, teamIds } = await seedRecords(t);
    const reads = new Map<string, number>();

    await t.run(async (ctx) => {
      const originalQuery = ctx.db.query.bind(ctx.db);
      ctx.db.query = ((tableName: string) => {
        reads.set(tableName, (reads.get(tableName) ?? 0) + 1);
        return originalQuery(tableName as never);
      }) as unknown as typeof ctx.db.query;
      await computeWeeklyPollForSeason(ctx as unknown as MutationCtx, {
        leagueId,
        seasonId,
        week: 1,
      });
    });

    const rows = await t.run((ctx) => ctx.db.query("weeklyPolls").collect());
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.rankingsJson)).toHaveLength(teamIds.length);
    expect(reads.get("seasonTeamRecords")).toBe(1);
    expect(reads.get("fixtures") ?? 0).toBe(0);
    expect(reads.get("gameResults") ?? 0).toBe(0);
  });

  it("stores honest week-one absence and returns team names through the query", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, teamIds } = await seedRecords(t, 4);

    await t.mutation(internal.history.computeWeeklyPoll, {
      leagueId,
      seasonId,
      week: 1,
    });
    const poll = await t.query(api.history.getWeeklyPoll, { seasonId });

    expect(poll?.rankings).toHaveLength(teamIds.length);
    expect(poll?.rankings.every((row) => row.previousRank === null)).toBe(true);
    expect(poll?.rankings.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
    expect(poll?.rankings.every((row) => row.teamName.startsWith("Poll Team ")))
      .toBe(true);
  });
});
