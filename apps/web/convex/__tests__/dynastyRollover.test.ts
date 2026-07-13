/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

const SYNTHETIC_ROSTER_TARGET = 5;

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

/** Synthetic league: players on teamId only — no rosterAssignments (WSM-000218). */
async function seedSyntheticRolloverFixture(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Synthetic HS",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Hawks",
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

    const seniorId = await ctx.db.insert("players", {
      name: "Senior WR",
      leagueId,
      teamId,
      position: "WR",
      positionGroup: null,
      jerseyNumber: 80,
      dateOfBirth: null,
      status: "Active",
      headshotUrl: null,
      grade: 12,
      squad: "Varsity",
      experienceYears: 3,
      synthetic: true,
    });
    const juniorId = await ctx.db.insert("players", {
      name: "Junior LB",
      leagueId,
      teamId,
      position: "LB",
      positionGroup: null,
      jerseyNumber: 44,
      dateOfBirth: null,
      status: "Active",
      headshotUrl: null,
      grade: 11,
      squad: "Varsity",
      experienceYears: 2,
      synthetic: true,
    });

    const underclassIds: Id<"players">[] = [];
    for (let i = 0; i < SYNTHETIC_ROSTER_TARGET - 2; i++) {
      underclassIds.push(
        await ctx.db.insert("players", {
          name: `Underclass ${i}`,
          leagueId,
          teamId,
          position: "OL",
          positionGroup: null,
          jerseyNumber: 50 + i,
          dateOfBirth: null,
          status: "Active",
          headshotUrl: null,
          grade: 10,
          squad: "JV",
          experienceYears: 1,
          synthetic: true,
        }),
      );
    }

    return {
      leagueId,
      teamId,
      seasonId,
      seniorId,
      juniorId,
      underclassIds,
    };
  });
}

function activePlayerCount(
  players: { status: string }[],
): number {
  return players.filter((p) => p.status !== "graduated").length;
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

  it("graduates and advances synthetic leagues without rosterAssignments", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, seniorId, juniorId } =
      await seedSyntheticRolloverFixture(t);

    const res = await t.mutation(internal.sports.rolloverGraduateAndAdvancePlayers, {
      leagueId,
      seasonId,
    });
    expect(res.graduatedPlayerIds).toEqual([seniorId as string]);
    expect(res.advancedPlayerIds).toContain(juniorId as string);

    const senior = await t.run((ctx) => ctx.db.get(seniorId));
    const junior = await t.run((ctx) => ctx.db.get(juniorId));
    expect(senior?.status).toBe("graduated");
    expect(junior?.grade).toBe(12);
    expect(junior?.experienceYears).toBe(3);
  });
});

describe("synthetic dynasty rollover flow (WSM-000218)", () => {
  it("records freshman progress per team so retries do not duplicate players", async () => {
    const t = convexTest(schema, modules);
    const { teamId, seasonId } = await seedSyntheticRolloverFixture(t);
    await t.run((ctx) => ctx.db.patch(seasonId, { status: "completed" }));
    const rollover = await t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    });
    await t.run((ctx) =>
      ctx.db.patch(rollover.rolloverId as Id<"seasonRollovers">, {
        stage: "rosters_copied",
        stageLeaseStage: "freshmen_created",
        stageLeaseOwnerId: "worker-1",
        stageLeaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );

    const players = [
      {
        name: "Freshman Retry",
        position: "RB",
        jerseyNumber: 20,
        status: "Active",
        grade: 9,
        squad: "Freshman",
      },
    ];
    const first = await t.mutation(internal.sports.createRolloverFreshmenForTeam, {
      rolloverId: rollover.rolloverId as Id<"seasonRollovers">,
      ownerId: "worker-1",
      teamId,
      players,
    });
    const retry = await t.mutation(internal.sports.createRolloverFreshmenForTeam, {
      rolloverId: rollover.rolloverId as Id<"seasonRollovers">,
      ownerId: "worker-1",
      teamId,
      players,
    });

    expect(first).toMatchObject({ created: 1, totalCreated: 1 });
    expect(retry).toMatchObject({
      created: 1,
      totalCreated: 1,
      alreadyCompleted: true,
    });
    const matchingPlayers = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("players")
        .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
        .collect();
      return rows.filter((player) => player.name === "Freshman Retry");
    });
    expect(matchingPlayers).toHaveLength(1);
  });

  it("copySeasonRosters no-ops, tops roster via team players, blocks re-rollover", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, teamId, seasonId, seniorId } =
      await seedSyntheticRolloverFixture(t);

    const { graduatedPlayerIds } = await t.mutation(
      internal.sports.rolloverGraduateAndAdvancePlayers,
      { leagueId, seasonId },
    );
    expect(graduatedPlayerIds).toEqual([seniorId as string]);

    const { dto: nextSeason } = await t.mutation(internal.sports.upsertSeason, {
      name: "2027",
      leagueId,
      startDate: "2027-09-01",
      endDate: null,
      status: "upcoming",
    });

    const copyRes = await t.mutation(internal.sports.copySeasonRosters, {
      targetSeasonId: nextSeason.id as Id<"seasons">,
      sourceSeasonId: seasonId,
      actorUserId: "user_1",
      confirm: true,
    });
    expect(copyRes.copiedAssignments).toBe(0);
    expect(copyRes.copiedDepthEntries).toBe(0);

    const teamPlayersBeforeTopUp = await t.query(api.sports.listPlayersByTeam, {
      teamId,
    });
    expect(activePlayerCount(teamPlayersBeforeTopUp)).toBe(
      SYNTHETIC_ROSTER_TARGET - 1,
    );

    const toCreate = Math.max(
      0,
      SYNTHETIC_ROSTER_TARGET - activePlayerCount(teamPlayersBeforeTopUp),
    );
    expect(toCreate).toBe(1);

    const { created } = await t.mutation(internal.sports.bulkCreatePlayers, {
      teamId,
      players: Array.from({ length: toCreate }, (_, i) => ({
        name: `Freshman ${i}`,
        position: "RB",
        jerseyNumber: 20 + i,
        status: "Active",
        grade: 9,
        squad: "Freshman",
      })),
    });
    expect(created).toBe(1);

    const teamPlayersAfterTopUp = await t.query(api.sports.listPlayersByTeam, {
      teamId,
    });
    expect(activePlayerCount(teamPlayersAfterTopUp)).toBe(
      SYNTHETIC_ROSTER_TARGET,
    );

    const seasons = await t.query(api.sports.listSeasons, {
      leagueIds: [leagueId],
    });
    expect(seasons.some((s) => s.status === "upcoming")).toBe(true);
    // Mirrors startNextSeasonAction guard: a second rollover is blocked.
    expect(seasons.filter((s) => s.status === "upcoming")).toHaveLength(1);
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
