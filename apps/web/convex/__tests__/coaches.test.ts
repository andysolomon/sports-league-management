/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateAiHeadCoachProfile } from "../lib/coach";

const modules = import.meta.glob("../**/*.*s");

async function seedLeague(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Coach League",
      orgId: "org_test",
      isPublic: false,
      inviteToken: null,
    });
    const teamA = await ctx.db.insert("teams", {
      name: "Alpha",
      leagueId,
      divisionId: null,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "City",
      logoUrl: null,
      rosterLimit: 53,
    } as never);
    const teamB = await ctx.db.insert("teams", {
      name: "Beta",
      leagueId,
      divisionId: null,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "City",
      logoUrl: null,
      rosterLimit: 53,
    } as never);
    return { leagueId, teamA, teamB };
  });
}

describe("generateAiHeadCoachProfile", () => {
  it("is deterministic for the same team id", () => {
    const a = generateAiHeadCoachProfile("team_alpha");
    const b = generateAiHeadCoachProfile("team_alpha");
    expect(a).toEqual(b);
  });
});

describe("seedAiHeadCoachesForLeague", () => {
  it("creates one head coach per team and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await seedLeague(t);

    const first = await t.mutation(internal.program.seedAiHeadCoachesForLeague, {
      leagueId,
    });
    expect(first.coachesCreated).toBe(2);
    expect(first.teamsScanned).toBe(2);

    const second = await t.mutation(internal.program.seedAiHeadCoachesForLeague, {
      leagueId,
    });
    expect(second.coachesCreated).toBe(0);

    const coaches = await t.run(async (ctx) =>
      ctx.db.query("coaches").collect(),
    );
    expect(coaches).toHaveLength(2);
  });
});

describe("coach queries", () => {
  it("lists coaches by team and reads a coach by id", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, teamA } = await seedLeague(t);
    await t.mutation(internal.program.seedAiHeadCoachesForLeague, { leagueId });

    const listed = await t.query(api.program.listCoachesByTeam, {
      teamId: teamA,
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]!.role).toBe("head_coach");

    const coach = await t.query(api.program.getCoach, {
      coachId: listed[0]!.id as Id<"coaches">,
    });
    expect(coach?.displayName).toBe(listed[0]!.displayName);
    expect(coach?.userId).toBeNull();
  });

  it("backfills coach seasons from season team records", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, teamA } = await seedLeague(t);

    await t.run(async (ctx) => {
      const seasonId = await ctx.db.insert("seasons", {
        leagueId,
        name: "2027",
        status: "completed",
        startDate: null,
        endDate: null,
        rosterLocked: true,
      });
      await ctx.db.insert("seasonTeamRecords", {
        leagueId,
        seasonId,
        teamId: teamA,
        divisionId: null,
        wins: 8,
        losses: 2,
        ties: 0,
        pointsFor: 200,
        pointsAgainst: 120,
        divisionWins: 4,
        divisionLosses: 1,
        divisionTies: 0,
        headToHeadJson: "{}",
        streak: 2,
        lastResults: ["W", "W"],
        gamesCounted: 10,
        updatedAt: new Date().toISOString(),
      });
    });

    await t.mutation(internal.program.seedAiHeadCoachesForLeague, { leagueId });
    const coaches = await t.query(api.program.listCoachesByTeam, {
      teamId: teamA,
    });
    const seasons = await t.query(api.program.listCoachSeasons, {
      coachId: coaches[0]!.id as Id<"coaches">,
    });
    expect(seasons).toHaveLength(1);
    expect(seasons[0]).toMatchObject({ wins: 8, losses: 2, ties: 0 });
  });
});
