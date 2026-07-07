/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { targetRosterSize } from "../lib/offseason";

const modules = import.meta.glob("../**/*.*s");

const ACTOR = "user_test_actor";

async function seedLeague(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "FA League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const teamA = await ctx.db.insert("teams", {
      name: "Team A",
      leagueId,
      divisionId: null,
      city: "A",
      stadium: "A",
      foundedYear: null,
      location: "A",
      logoUrl: null,
      rosterLimit: null,
    });
    const teamB = await ctx.db.insert("teams", {
      name: "Team B",
      leagueId,
      divisionId: null,
      city: "B",
      stadium: "B",
      foundedYear: null,
      location: "B",
      logoUrl: null,
      rosterLimit: null,
    });
    const activeSeason = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const upcomingSeason = await ctx.db.insert("seasons", {
      name: "2027",
      leagueId,
      startDate: null,
      endDate: null,
      status: "upcoming",
      rosterLocked: false,
    });
    const player = await ctx.db.insert("players", {
      name: "Release Me",
      leagueId,
      teamId: teamA,
      position: "WR",
      positionGroup: null,
      jerseyNumber: 11,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
      grade: 11,
    });
    const rostered = await ctx.db.insert("players", {
      name: "Stay Active",
      leagueId,
      teamId: teamA,
      position: "QB",
      positionGroup: null,
      jerseyNumber: 1,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
    });
    const assignmentId = await ctx.db.insert("rosterAssignments", {
      seasonId: upcomingSeason,
      teamId: teamA,
      playerId: player,
      leagueId,
      depthRank: 1,
      positionSlot: "WR",
      status: "active",
      assignedAt: new Date().toISOString(),
      assignedBy: ACTOR,
    });
    const depthId = await ctx.db.insert("depthChartEntries", {
      teamId: teamA,
      seasonId: upcomingSeason,
      playerId: player,
      positionSlot: "WR",
      sortOrder: 0,
      updatedAt: new Date().toISOString(),
    });
    return {
      leagueId,
      teamA,
      teamB,
      activeSeason,
      upcomingSeason,
      player,
      rostered,
      assignmentId,
      depthId,
    };
  });
}

describe("releasePlayerToFreeAgency", () => {
  it("sets free_agent and removes assignment + depth rows for offseason seasons", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);

    const result = await t.mutation(internal.sports.releasePlayerToFreeAgency, {
      playerId: seed.player,
    });
    expect(result.playerId).toBe(seed.player);

    const player = await t.run((ctx) => ctx.db.get(seed.player));
    expect(player?.status).toBe("free_agent");
    expect(player?.teamId).toBe(seed.teamA);

    const assignments = await t.run((ctx) =>
      ctx.db.query("rosterAssignments").collect(),
    );
    expect(assignments.find((a) => a._id === seed.assignmentId)).toBeUndefined();

    const depth = await t.run((ctx) =>
      ctx.db.query("depthChartEntries").collect(),
    );
    expect(depth.find((d) => d._id === seed.depthId)).toBeUndefined();
  });
});

describe("signFreeAgent", () => {
  async function seedFreeAgent(t: ReturnType<typeof convexTest>) {
    const base = await seedLeague(t);
    await t.mutation(internal.sports.releasePlayerToFreeAgency, {
      playerId: base.player,
    });
    return base;
  }

  it("restores active status with assignment and depth chart entry", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedFreeAgent(t);

    const result = await t.mutation(internal.sports.signFreeAgent, {
      playerId: seed.player,
      teamId: seed.teamB,
      seasonId: seed.upcomingSeason,
      actorUserId: ACTOR,
    });
    expect(result.teamId).toBe(seed.teamB);
    expect(result.overCap).toBe(false);

    const player = await t.run((ctx) => ctx.db.get(seed.player));
    expect(player?.status).toBe("active");
    expect(player?.teamId).toBe(seed.teamB);

    const assignments = await t.run((ctx) =>
      ctx.db
        .query("rosterAssignments")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", seed.upcomingSeason).eq("teamId", seed.teamB),
        )
        .collect(),
    );
    expect(assignments.some((a) => a.playerId === seed.player)).toBe(true);

    const depth = await t.run((ctx) =>
      ctx.db
        .query("depthChartEntries")
        .withIndex("by_team_season", (q) =>
          q.eq("teamId", seed.teamB).eq("seasonId", seed.upcomingSeason),
        )
        .collect(),
    );
    expect(depth.some((d) => d.playerId === seed.player)).toBe(true);
  });

  it("returns overCap when the team is already at target roster size", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedFreeAgent(t);
    const cap = targetRosterSize();

    await t.run(async (ctx) => {
      for (let i = 0; i < cap; i++) {
        await ctx.db.insert("players", {
          name: `Bench ${i}`,
          leagueId: seed.leagueId,
          teamId: seed.teamB,
          position: "HB",
          positionGroup: null,
          jerseyNumber: i + 20,
          dateOfBirth: null,
          status: "active",
          headshotUrl: null,
        });
      }
    });

    const result = await t.mutation(internal.sports.signFreeAgent, {
      playerId: seed.player,
      teamId: seed.teamB,
      seasonId: seed.upcomingSeason,
      actorUserId: ACTOR,
    });
    expect(result.overCap).toBe(true);

    const player = await t.run((ctx) => ctx.db.get(seed.player));
    expect(player?.status).toBe("active");
  });
});

describe("listFreeAgents", () => {
  it("returns only free_agent players in the league with ratings when present", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    await t.mutation(internal.sports.releasePlayerToFreeAgency, {
      playerId: seed.player,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("playerAttributes", {
        playerId: seed.player,
        seasonId: seed.upcomingSeason,
        positionGroup: "WR",
        attributesJson: "{}",
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 1,
        weightedOverall: 82,
        ingestedAt: new Date().toISOString(),
      });
    });

    const rows = await t.query(api.sports.listFreeAgents, {
      leagueId: seed.leagueId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(seed.player);
    expect(rows[0].name).toBe("Release Me");
    expect(rows[0].position).toBe("WR");
    expect(rows[0].grade).toBe(11);
    expect(rows[0].overall).toBe(82);
    expect(rows[0].teamId).toBe(seed.teamA);
  });
});
