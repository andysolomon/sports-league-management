/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

const ACTOR = "user_test_actor";

async function seed(
  t: ReturnType<typeof convexTest>,
  rosterLimit: number | null = 53,
) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Query League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const team = await ctx.db.insert("teams", {
      name: "Team",
      leagueId,
      divisionId: null,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "Loc",
      logoUrl: null,
      rosterLimit,
    });
    const season = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const otherSeason = await ctx.db.insert("seasons", {
      name: "2025",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const makePlayer = async (name: string, position: string) =>
      ctx.db.insert("players", {
        name,
        leagueId,
        teamId: team,
        position,
        positionGroup: null,
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
      });
    const qb1 = await makePlayer("QB1", "QB");
    const qb2 = await makePlayer("QB2", "QB");
    const rb1 = await makePlayer("RB1", "HB");
    return { leagueId, team, season, otherSeason, qb1, qb2, rb1 };
  });
}

describe("getRosterBySeasonTeam", () => {
  it("returns an empty array when no assignments exist", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    const rows = await t.query(api.sports.getRosterBySeasonTeam, {
      seasonId: s.season,
      teamId: s.team,
    });

    expect(rows).toEqual([]);
  });

  it("sorts by positionSlot, then active before non-active, then depthRank", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.rb1,
      positionSlot: "HB",
      actorUserId: ACTOR,
    });

    const rows = await t.query(api.sports.getRosterBySeasonTeam, {
      seasonId: s.season,
      teamId: s.team,
    });

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.positionSlot)).toEqual(["HB", "QB", "QB"]);
    expect(rows[0].playerId).toBe(s.rb1);
    expect(rows[1].playerId).toBe(s.qb1);
    expect(rows[1].depthRank).toBe(1);
    expect(rows[2].playerId).toBe(s.qb2);
    expect(rows[2].depthRank).toBe(2);
  });

  it("puts non-active rows after active rows within a slot", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    const a1 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.updateRosterStatus, {
      assignmentId: a1.id as Id<"rosterAssignments">,
      newStatus: "ir",
      actorUserId: ACTOR,
    });

    const rows = await t.query(api.sports.getRosterBySeasonTeam, {
      seasonId: s.season,
      teamId: s.team,
    });

    expect(rows.map((r) => r.status)).toEqual(["active", "ir"]);
    expect(rows[0].playerId).toBe(s.qb2);
    expect(rows[0].depthRank).toBe(1);
    expect(rows[1].playerId).toBe(s.qb1);
  });

  it("ignores assignments from other seasons", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.otherSeason,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    const rows = await t.query(api.sports.getRosterBySeasonTeam, {
      seasonId: s.season,
      teamId: s.team,
    });

    expect(rows).toEqual([]);
  });
});

describe("getTeamRosterLimitStatus", () => {
  it("reports zero active with the team's rosterLimit", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t, 3);

    const status = await t.query(api.sports.getTeamRosterLimitStatus, {
      seasonId: s.season,
      teamId: s.team,
    });

    expect(status).toEqual({
      activeCount: 0,
      rosterLimit: 3,
      remaining: 3,
    });
  });

  it("reports remaining decrementing as assignments land", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t, 2);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    const status = await t.query(api.sports.getTeamRosterLimitStatus, {
      seasonId: s.season,
      teamId: s.team,
    });

    expect(status).toEqual({
      activeCount: 1,
      rosterLimit: 2,
      remaining: 1,
    });
  });

  it("treats null rosterLimit as unlimited (remaining stays null)", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t, null);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    const status = await t.query(api.sports.getTeamRosterLimitStatus, {
      seasonId: s.season,
      teamId: s.team,
    });

    expect(status).toEqual({
      activeCount: 1,
      rosterLimit: null,
      remaining: null,
    });
  });

  it("excludes non-active rows from the count", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t, 5);

    const a1 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.updateRosterStatus, {
      assignmentId: a1.id as Id<"rosterAssignments">,
      newStatus: "ir",
      actorUserId: ACTOR,
    });

    const status = await t.query(api.sports.getTeamRosterLimitStatus, {
      seasonId: s.season,
      teamId: s.team,
    });

    expect(status.activeCount).toBe(0);
    expect(status.remaining).toBe(5);
  });
});

describe("getRosterAssignmentHistory", () => {
  it("returns all team/season audit rows when playerId is null, newest first", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    const rows = await t.query(api.sports.getRosterAssignmentHistory, {
      teamId: s.team,
      seasonId: s.season,
      playerId: null,
      limit: null,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe("assign");
    expect(rows[0].createdAt >= rows[1].createdAt).toBe(true);
  });

  it("filters rows by playerId via JSON snapshot match", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    const a1 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.updateRosterStatus, {
      assignmentId: a1.id as Id<"rosterAssignments">,
      newStatus: "ir",
      actorUserId: ACTOR,
    });

    const rows = await t.query(api.sports.getRosterAssignmentHistory, {
      teamId: s.team,
      seasonId: s.season,
      playerId: s.qb1,
      limit: null,
    });

    expect(rows.map((r) => r.action).sort()).toEqual(["assign", "status_change"]);
  });

  it("honours the limit arg when provided", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.season,
      teamId: s.team,
      playerId: s.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    const rows = await t.query(api.sports.getRosterAssignmentHistory, {
      teamId: s.team,
      seasonId: s.season,
      playerId: null,
      limit: 1,
    });

    expect(rows).toHaveLength(1);
  });

  it("excludes audit rows from other seasons", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: s.otherSeason,
      teamId: s.team,
      playerId: s.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    const rows = await t.query(api.sports.getRosterAssignmentHistory, {
      teamId: s.team,
      seasonId: s.season,
      playerId: null,
      limit: null,
    });

    expect(rows).toEqual([]);
  });
});
