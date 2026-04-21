import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

async function seedBaseline(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Test League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const teamA = await ctx.db.insert("teams", {
      name: "Alpha",
      leagueId,
      divisionId: null,
      city: "A",
      stadium: "A",
      foundedYear: null,
      location: "A",
      logoUrl: null,
    });
    const teamB = await ctx.db.insert("teams", {
      name: "Beta",
      leagueId,
      divisionId: null,
      city: "B",
      stadium: "B",
      foundedYear: null,
      location: "B",
      logoUrl: null,
    });
    const season = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const p1 = await ctx.db.insert("players", {
      name: "QB1",
      leagueId,
      teamId: teamA,
      position: "QB",
      jerseyNumber: 1,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
    });
    const p2 = await ctx.db.insert("players", {
      name: "QB2",
      leagueId,
      teamId: teamA,
      position: "QB",
      jerseyNumber: 2,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
    });
    const p3 = await ctx.db.insert("players", {
      name: "QB3",
      leagueId,
      teamId: teamA,
      position: "QB",
      jerseyNumber: 3,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
    });
    const pB = await ctx.db.insert("players", {
      name: "QB-B",
      leagueId,
      teamId: teamB,
      position: "QB",
      jerseyNumber: 9,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
    });
    return { leagueId, teamA, teamB, season, p1, p2, p3, pB };
  });
}

describe("reorderDepthChart", () => {
  it("assigns dense zero-indexed sortOrder in the given playerIds order", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedBaseline(t);

    const result = await t.mutation(api.sports.reorderDepthChart, {
      teamId: seed.teamA,
      seasonId: seed.season,
      positionSlot: "QB",
      playerIds: [seed.p3, seed.p1, seed.p2],
    });

    expect(result.map((r) => r.playerId)).toEqual([seed.p3, seed.p1, seed.p2]);
    expect(result.map((r) => r.sortOrder)).toEqual([0, 1, 2]);
  });

  it("replaces existing entries on re-order (no duplicates)", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedBaseline(t);

    await t.mutation(api.sports.reorderDepthChart, {
      teamId: seed.teamA,
      seasonId: seed.season,
      positionSlot: "QB",
      playerIds: [seed.p1, seed.p2, seed.p3],
    });
    await t.mutation(api.sports.reorderDepthChart, {
      teamId: seed.teamA,
      seasonId: seed.season,
      positionSlot: "QB",
      playerIds: [seed.p3, seed.p1],
    });

    const rows = await t.query(api.sports.getDepthChartByTeamSeason, {
      teamId: seed.teamA,
      seasonId: seed.season,
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.playerId)).toEqual([seed.p3, seed.p1]);
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1]);
  });

  it("rejects when the season is locked", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedBaseline(t);

    await t.mutation(api.sports.setRosterLocked, {
      seasonId: seed.season,
      locked: true,
    });

    await expect(
      t.mutation(api.sports.reorderDepthChart, {
        teamId: seed.teamA,
        seasonId: seed.season,
        positionSlot: "QB",
        playerIds: [seed.p1],
      }),
    ).rejects.toThrow(/season_locked/);
  });

  it("rejects a player that belongs to a different team", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedBaseline(t);

    await expect(
      t.mutation(api.sports.reorderDepthChart, {
        teamId: seed.teamA,
        seasonId: seed.season,
        positionSlot: "QB",
        playerIds: [seed.p1, seed.pB],
      }),
    ).rejects.toThrow(/player_not_on_team/);
  });
});

describe("setRosterLocked", () => {
  it("toggles rosterLocked on the season", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedBaseline(t);

    const locked = await t.mutation(api.sports.setRosterLocked, {
      seasonId: seed.season,
      locked: true,
    });
    expect(locked.rosterLocked).toBe(true);

    const unlocked = await t.mutation(api.sports.setRosterLocked, {
      seasonId: seed.season,
      locked: false,
    });
    expect(unlocked.rosterLocked).toBe(false);
  });
});
