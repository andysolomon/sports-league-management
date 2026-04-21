/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import schema from "../schema";
import { api } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

const ACTOR = "migration:WSM-000016";

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Migration League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const teamA = await ctx.db.insert("teams", {
      name: "A",
      leagueId,
      divisionId: null,
      city: "A",
      stadium: "A",
      foundedYear: null,
      location: "A",
      logoUrl: null,
      rosterLimit: 53,
    });
    const season = await ctx.db.insert("seasons", {
      name: "2026",
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
        teamId: teamA,
        position,
        positionGroup: null,
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
      });
    const qb1 = await makePlayer("QB1", "QB");
    const qb2 = await makePlayer("QB2", "QB");
    const qb3 = await makePlayer("QB3", "QB");

    await ctx.db.insert("depthChartEntries", {
      teamId: teamA,
      seasonId: season,
      playerId: qb1,
      positionSlot: "QB",
      sortOrder: 0,
      updatedAt: new Date().toISOString(),
    });
    await ctx.db.insert("depthChartEntries", {
      teamId: teamA,
      seasonId: season,
      playerId: qb2,
      positionSlot: "QB",
      sortOrder: 1,
      updatedAt: new Date().toISOString(),
    });
    await ctx.db.insert("depthChartEntries", {
      teamId: teamA,
      seasonId: season,
      playerId: qb3,
      positionSlot: "QB",
      sortOrder: 2,
      updatedAt: new Date().toISOString(),
    });
    return { leagueId, teamA, season, qb1, qb2, qb3 };
  });
}

describe("migrateDepthChartToRoster", () => {
  it("copies every depth-chart entry into rosterAssignments with 1-indexed depthRank", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    const result = await t.mutation(
      anyApi.migrations["20260428_depthChartToRoster"].migrateDepthChartToRoster,
      { actorUserId: ACTOR },
    );

    expect(result).toEqual({ scanned: 3, copied: 3, skipped: 0 });

    const rows = await t.query(api.sports.getRosterBySeasonTeam, {
      seasonId: s.season,
      teamId: s.teamA,
    });

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.depthRank)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.playerId)).toEqual([s.qb1, s.qb2, s.qb3]);
    expect(rows.every((r) => r.status === "active")).toBe(true);
    expect(rows.every((r) => r.assignedBy === ACTOR)).toBe(true);
  });

  it("is idempotent — a second run skips existing rows", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    await t.mutation(
      anyApi.migrations["20260428_depthChartToRoster"].migrateDepthChartToRoster,
      { actorUserId: ACTOR },
    );
    const second = await t.mutation(
      anyApi.migrations["20260428_depthChartToRoster"].migrateDepthChartToRoster,
      { actorUserId: ACTOR },
    );

    expect(second).toEqual({ scanned: 3, copied: 0, skipped: 3 });

    const rows = await t.query(api.sports.getRosterBySeasonTeam, {
      seasonId: s.season,
      teamId: s.teamA,
    });
    expect(rows).toHaveLength(3);
  });

  it("writes one audit row per copied assignment", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    await t.mutation(
      anyApi.migrations["20260428_depthChartToRoster"].migrateDepthChartToRoster,
      { actorUserId: ACTOR },
    );

    const history = await t.query(api.sports.getRosterAssignmentHistory, {
      teamId: s.teamA,
      seasonId: s.season,
      playerId: null,
      limit: null,
    });

    expect(history).toHaveLength(3);
    expect(history.every((row) => row.action === "assign")).toBe(true);
    expect(history.every((row) => row.actorUserId === ACTOR)).toBe(true);
  });
});
