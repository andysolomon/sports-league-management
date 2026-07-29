/// <reference types="vite/client" />
import { describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import * as goalsModule from "../lib/goals";

const modules = import.meta.glob("../**/*.*s");

async function seedLeagueWithCoaches(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Program League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const teamA = await ctx.db.insert("teams", {
      name: "Alphas",
      leagueId,
      divisionId: null,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "Loc",
      logoUrl: null,
      rosterLimit: 53,
    });
    const teamB = await ctx.db.insert("teams", {
      name: "Betas",
      leagueId,
      divisionId: null,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "Loc",
      logoUrl: null,
      rosterLimit: 53,
    });
    const seasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: "2026-09-01",
      endDate: null,
      status: "active",
      rosterLocked: false,
    });

    for (const teamId of [teamA, teamB]) {
      await ctx.db.insert("seasonTeamRecords", {
        leagueId,
        seasonId,
        teamId,
        divisionId: null,
        wins: 6,
        losses: 4,
        ties: 0,
        pointsFor: 280,
        pointsAgainst: 220,
        divisionWins: 3,
        divisionLosses: 2,
        divisionTies: 0,
        headToHeadJson: "{}",
        streak: 1,
        lastResults: ["W"],
        gamesCounted: 10,
        updatedAt: new Date().toISOString(),
      });
    }

    return { leagueId, seasonId, teamA, teamB };
  });
}

describe("completeSeason program finalize (C2)", () => {
  it("writes program, coach-season and finalized fields once per team", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId } = await seedLeagueWithCoaches(t);
    await t.mutation(internal.program.seedAiHeadCoachesForLeague, { leagueId });

    await t.mutation(internal.sports.completeSeason, { seasonId, force: true });

    const programs = await t.run((ctx) =>
      ctx.db
        .query("teamSeasonPrograms")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );
    expect(programs).toHaveLength(2);
    for (const row of programs) {
      expect(row.prestige).toBeTypeOf("number");
      expect(row.seasonGoalsJson).toBeTruthy();
      expect(row.jobSecurity).toBeTypeOf("number");
    }

    const coachSeasons = await t.run((ctx) =>
      ctx.db.query("coachSeasons").collect(),
    );
    expect(coachSeasons).toHaveLength(2);
    for (const row of coachSeasons) {
      expect(row.finalizedAt).toBeTruthy();
      expect(row.goalsMetJson).toBeTruthy();
      expect(row.prestigeDelta).toBeTypeOf("number");
    }
  });

  it("is idempotent on re-completion", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId } = await seedLeagueWithCoaches(t);
    await t.mutation(internal.program.seedAiHeadCoachesForLeague, { leagueId });

    await t.mutation(internal.sports.completeSeason, { seasonId, force: true });
    const firstPrograms = await t.run((ctx) =>
      ctx.db
        .query("teamSeasonPrograms")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );

    await t.mutation(internal.sports.completeSeason, { seasonId, force: true });
    const secondPrograms = await t.run((ctx) =>
      ctx.db
        .query("teamSeasonPrograms")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );

    expect(secondPrograms).toHaveLength(firstPrograms.length);
    expect(secondPrograms.map((r) => r._id).sort()).toEqual(
      firstPrograms.map((r) => r._id).sort(),
    );
  });

  it("goal evaluation performs zero reads of playerGameStats or fixtures", async () => {
    const evaluateSpy = vi.spyOn(goalsModule, "evaluateGoals");
    evaluateSpy.mockClear();

    const t = convexTest(schema, modules);
    const { leagueId, seasonId } = await seedLeagueWithCoaches(t);
    await t.mutation(internal.program.seedAiHeadCoachesForLeague, { leagueId });

    let fixtureReads = 0;
    let gameStatReads = 0;

    await t.run(async (ctx) => {
      const originalQuery = ctx.db.query.bind(ctx.db);
      ctx.db.query = ((tableName: string) => {
        if (tableName === "fixtures") fixtureReads += 1;
        if (tableName === "playerGameStats") gameStatReads += 1;
        return originalQuery(tableName as never);
      }) as unknown as typeof ctx.db.query;

      const { finalizeProgramSeason } = await import("../lib/programFinalize");
      await finalizeProgramSeason(ctx, seasonId as Id<"seasons">);
    });

    expect(evaluateSpy).toHaveBeenCalled();
    expect(fixtureReads).toBe(0);
    expect(gameStatReads).toBe(0);
    evaluateSpy.mockRestore();
  });
});
