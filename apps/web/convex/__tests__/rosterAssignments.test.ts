/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

const asAssignmentId = (id: string) => id as Id<"rosterAssignments">;

const ACTOR = "user_test_actor";

async function seed(
  t: ReturnType<typeof convexTest>,
  rosterLimit: number | null = 53,
) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Roster League",
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
      rosterLimit,
    });
    const teamB = await ctx.db.insert("teams", {
      name: "B",
      leagueId,
      divisionId: null,
      city: "B",
      stadium: "B",
      foundedYear: null,
      location: "B",
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
    const makePlayer = async (name: string, position: string, teamId: typeof teamA) =>
      ctx.db.insert("players", {
        name,
        leagueId,
        teamId,
        position,
        positionGroup: null,
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
      });
    const qb1 = await makePlayer("QB1", "QB", teamA);
    const qb2 = await makePlayer("QB2", "QB", teamA);
    const qb3 = await makePlayer("QB3", "QB", teamA);
    const rb1 = await makePlayer("RB1", "HB", teamA);
    const qbB = await makePlayer("QB-B", "QB", teamB);
    return { leagueId, teamA, teamB, season, qb1, qb2, qb3, rb1, qbB };
  });
}

describe("assignPlayerToRoster", () => {
  it("appends an active row with the next depthRank in the slot", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    const first = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    expect(first.depthRank).toBe(1);
    expect(first.status).toBe("active");

    const second = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    expect(second.depthRank).toBe(2);
  });

  it("writes an audit row with action=assign", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    const audit = await t.run((ctx) =>
      ctx.db.query("rosterAuditLog").collect(),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("assign");
    expect(audit[0].beforeJson).toBeNull();
    expect(audit[0].afterJson).not.toBeNull();
  });

  it("rejects when the season is locked", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    await t.mutation(api.sports.setRosterLocked, {
      seasonId: seed1.season,
      locked: true,
    });

    await expect(
      t.mutation(api.sports.assignPlayerToRoster, {
        seasonId: seed1.season,
        teamId: seed1.teamA,
        playerId: seed1.qb1,
        positionSlot: "QB",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/season_locked/);
  });

  it("rejects when roster limit is reached", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t, 2);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    await expect(
      t.mutation(api.sports.assignPlayerToRoster, {
        seasonId: seed1.season,
        teamId: seed1.teamA,
        playerId: seed1.qb3,
        positionSlot: "QB",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/roster_limit_exceeded/);
  });

  it("allows unlimited assignments when rosterLimit is null", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t, null);

    const r1 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    const r2 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    expect(r1.depthRank).toBe(1);
    expect(r2.depthRank).toBe(2);
  });

  it("rejects adding the same player twice while active", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    await expect(
      t.mutation(api.sports.assignPlayerToRoster, {
        seasonId: seed1.season,
        teamId: seed1.teamA,
        playerId: seed1.qb1,
        positionSlot: "QB",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/player_already_on_roster/);
  });

  it("rejects a player that belongs to another team", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    await expect(
      t.mutation(api.sports.assignPlayerToRoster, {
        seasonId: seed1.season,
        teamId: seed1.teamA,
        playerId: seed1.qbB,
        positionSlot: "QB",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/player_not_on_team/);
  });
});

describe("removePlayerFromRoster", () => {
  it("deletes the row and compacts remaining depthRanks", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    const a1 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    const a2 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb3,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    await t.mutation(api.sports.removePlayerFromRoster, {
      assignmentId: asAssignmentId(a1.id),
      actorUserId: ACTOR,
    });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("rosterAssignments")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", seed1.season).eq("teamId", seed1.teamA),
        )
        .collect(),
    );
    expect(rows.map((r) => r.depthRank).sort()).toEqual([1, 2]);
    const remaining = rows.find((r) => r._id === a2.id);
    expect(remaining?.depthRank).toBe(1);
  });

  it("rejects removing a non-active assignment", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    const a = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.updateRosterStatus, {
      assignmentId: asAssignmentId(a.id),
      newStatus: "ir",
      actorUserId: ACTOR,
    });

    await expect(
      t.mutation(api.sports.removePlayerFromRoster, {
        assignmentId: asAssignmentId(a.id),
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/cannot_remove_non_active/);
  });
});

describe("updateRosterStatus", () => {
  it("moves active → ir, zeroes depthRank, compacts the slot", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    const a1 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    const a2 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    const updated = await t.mutation(api.sports.updateRosterStatus, {
      assignmentId: asAssignmentId(a1.id),
      newStatus: "ir",
      actorUserId: ACTOR,
    });
    expect(updated.status).toBe("ir");
    expect(updated.depthRank).toBe(0);

    const stillActive = await t.run((ctx) =>
      ctx.db.get(asAssignmentId(a2.id)),
    );
    expect(stillActive?.depthRank).toBe(1);
  });

  it("rejects an invalid status value", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    const a = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    await expect(
      t.mutation(api.sports.updateRosterStatus, {
        assignmentId: asAssignmentId(a.id),
        newStatus: "bogus",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/invalid_status/);
  });

  it("requires an open slot when reactivating; assigns next depthRank", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t, 2);

    const a1 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    await t.mutation(api.sports.updateRosterStatus, {
      assignmentId: asAssignmentId(a1.id),
      newStatus: "ir",
      actorUserId: ACTOR,
    });

    // With rosterLimit 2 and one remaining active, we can reactivate a1.
    const back = await t.mutation(api.sports.updateRosterStatus, {
      assignmentId: asAssignmentId(a1.id),
      newStatus: "active",
      actorUserId: ACTOR,
    });
    expect(back.status).toBe("active");
    expect(back.depthRank).toBe(2);
  });

  it("rejects reactivation when roster is already at limit", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t, 2);

    const a1 = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb2,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    await t.mutation(api.sports.updateRosterStatus, {
      assignmentId: asAssignmentId(a1.id),
      newStatus: "ir",
      actorUserId: ACTOR,
    });

    // Fill the freed slot with qb3.
    await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb3,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });

    await expect(
      t.mutation(api.sports.updateRosterStatus, {
        assignmentId: asAssignmentId(a1.id),
        newStatus: "active",
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/roster_limit_exceeded/);
  });

  it("writes an audit row with action=status_change", async () => {
    const t = convexTest(schema, modules);
    const seed1 = await seed(t);

    const a = await t.mutation(api.sports.assignPlayerToRoster, {
      seasonId: seed1.season,
      teamId: seed1.teamA,
      playerId: seed1.qb1,
      positionSlot: "QB",
      actorUserId: ACTOR,
    });
    await t.mutation(api.sports.updateRosterStatus, {
      assignmentId: asAssignmentId(a.id),
      newStatus: "suspended",
      actorUserId: ACTOR,
    });

    const audit = await t.run((ctx) =>
      ctx.db.query("rosterAuditLog").collect(),
    );
    const statusAudits = audit.filter((r) => r.action === "status_change");
    expect(statusAudits).toHaveLength(1);
    expect(statusAudits[0].beforeJson).not.toBeNull();
    expect(statusAudits[0].afterJson).not.toBeNull();
  });
});
