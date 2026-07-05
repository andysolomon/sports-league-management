/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

async function seedRolloverFixture(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "HS League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Eagles",
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
    const nextSeasonId = await ctx.db.insert("seasons", {
      name: "2027",
      leagueId,
      startDate: "2027-09-01",
      endDate: null,
      status: "upcoming",
      rosterLocked: false,
    });

    const seniorId = await ctx.db.insert("players", {
      name: "Senior QB",
      leagueId,
      teamId,
      position: "QB",
      positionGroup: null,
      jerseyNumber: 12,
      dateOfBirth: null,
      status: "Active",
      headshotUrl: null,
      grade: 12,
      squad: "Varsity",
      experienceYears: 3,
    });
    const juniorId = await ctx.db.insert("players", {
      name: "Junior RB",
      leagueId,
      teamId,
      position: "RB",
      positionGroup: null,
      jerseyNumber: 22,
      dateOfBirth: null,
      status: "Active",
      headshotUrl: null,
      grade: 11,
      squad: "Varsity",
      experienceYears: 2,
    });

    for (const [playerId, slot] of [
      [seniorId, "QB"],
      [juniorId, "RB"],
    ] as const) {
      await ctx.db.insert("rosterAssignments", {
        seasonId,
        teamId,
        playerId,
        leagueId,
        depthRank: 1,
        positionSlot: slot,
        status: "active",
        assignedAt: new Date().toISOString(),
        assignedBy: "user_1",
      });
      await ctx.db.insert("depthChartEntries", {
        teamId,
        seasonId,
        playerId,
        positionSlot: slot,
        sortOrder: 1,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      leagueId,
      teamId,
      seasonId,
      nextSeasonId,
      seniorId,
      juniorId,
    };
  });
}

describe("rolloverGraduateAndAdvancePlayers", () => {
  it("graduates grade-12 players and advances others", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, seniorId, juniorId } =
      await seedRolloverFixture(t);

    const res = await t.mutation(internal.sports.rolloverGraduateAndAdvancePlayers, {
      leagueId,
      seasonId,
    });
    expect(res.graduatedPlayerIds).toEqual([seniorId as string]);
    expect(res.advancedPlayerIds).toEqual([juniorId as string]);

    const senior = await t.run((ctx) => ctx.db.get(seniorId));
    const junior = await t.run((ctx) => ctx.db.get(juniorId));
    expect(senior?.status).toBe("graduated");
    expect(junior?.grade).toBe(12);
    expect(junior?.experienceYears).toBe(3);
    expect(junior?.squad).toBe("Varsity");
  });
});

describe("removePlayersFromSeasonRoster", () => {
  it("removes assignments and depth entries for graduated players", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, nextSeasonId, seniorId, juniorId } =
      await seedRolloverFixture(t);

    await t.mutation(internal.sports.copySeasonRosters, {
      targetSeasonId: nextSeasonId,
      sourceSeasonId: seasonId,
      actorUserId: "user_1",
      confirm: true,
    });

    const before = await t.run(async (ctx) =>
      ctx.db
        .query("rosterAssignments")
        .withIndex("by_leagueId_seasonId", (q) =>
          q.eq("leagueId", leagueId).eq("seasonId", nextSeasonId),
        )
        .collect(),
    );
    expect(before).toHaveLength(2);

    const removed = await t.mutation(internal.sports.removePlayersFromSeasonRoster, {
      leagueId,
      seasonId: nextSeasonId,
      playerIds: [seniorId],
    });
    expect(removed.removedAssignments).toBe(1);
    expect(removed.removedDepthEntries).toBe(1);

    const after = await t.run(async (ctx) =>
      ctx.db
        .query("rosterAssignments")
        .withIndex("by_leagueId_seasonId", (q) =>
          q.eq("leagueId", leagueId).eq("seasonId", nextSeasonId),
        )
        .collect(),
    );
    expect(after.map((r) => r.playerId)).toEqual([juniorId]);
  });
});
