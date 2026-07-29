/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

describe("Hall of Fame induction", () => {
  it("creates exactly one class when the same season is rolled over twice", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "Long Running League",
        orgId: "org_hof",
        isPublic: false,
        inviteToken: null,
      });
      const teamId = await ctx.db.insert("teams", {
        name: "Legends",
        leagueId,
        divisionId: null,
        city: "History",
        stadium: "Legacy Field",
        foundedYear: null,
        location: "History, HS",
        logoUrl: null,
        rosterLimit: 53,
      });
      const seasonIds = [];
      for (let year = 2030; year <= 2033; year++) {
        seasonIds.push(
          await ctx.db.insert("seasons", {
            name: String(year),
            leagueId,
            startDate: `${year}-09-01`,
            endDate: null,
            status: "completed",
            rosterLocked: false,
          }),
        );
      }
      const playerId = await ctx.db.insert("players", {
        name: "First Ballot",
        leagueId,
        teamId,
        position: "QB",
        positionGroup: "QB",
        jerseyNumber: 12,
        dateOfBirth: null,
        status: "graduated",
        headshotUrl: null,
      });
      const totals = { passing: { yards: 4_000, td: 45 } };
      await ctx.db.insert("playerCareerTotals", {
        leagueId,
        playerId,
        totalsJson: JSON.stringify(totals),
        seasonTotalsJson: JSON.stringify({
          [seasonIds[0] as string]: totals,
        }),
        peakOverall: 96,
        championshipSeasonIds: [seasonIds[0]!],
        updatedAt: new Date(0).toISOString(),
      });
      return {
        leagueId,
        playerId,
        sourceSeasonId: seasonIds.at(-1)!,
      };
    });

    const firstRollover = await t.mutation(
      internal.sports.beginSeasonRollover,
      { sourceSeasonId: seeded.sourceSeasonId },
    );
    await t.mutation(internal.history.inductHallOfFameClass, {
      leagueId: seeded.leagueId,
      inductedSeasonId: seeded.sourceSeasonId,
    });
    const retryRollover = await t.mutation(
      internal.sports.beginSeasonRollover,
      { sourceSeasonId: seeded.sourceSeasonId },
    );
    await t.mutation(internal.history.inductHallOfFameClass, {
      leagueId: seeded.leagueId,
      inductedSeasonId: seeded.sourceSeasonId,
    });

    expect(retryRollover.rolloverId).toBe(firstRollover.rolloverId);
    const rows = await t.query(api.history.listHallOfFame, {
      leagueId: seeded.leagueId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipientId: seeded.playerId,
      recipientName: "First Ballot",
      classLabel: "Hall of Fame Class of 2033",
    });
  });
});
