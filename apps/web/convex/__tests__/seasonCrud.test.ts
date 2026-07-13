/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

/** Seed a league with two teams and a season; return ids needed by the tests. */
async function seedLeagueWithSeason(
  t: ReturnType<typeof convexTest>,
  status = "active",
) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Season League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const divisionId = await ctx.db.insert("divisions", {
      name: "Div 1",
      leagueId,
    });
    const teamIds: Id<"teams">[] = [];
    for (let i = 0; i < 2; i++) {
      teamIds.push(
        await ctx.db.insert("teams", {
          name: `Team ${i}`,
          leagueId,
          divisionId,
          city: "City",
          stadium: "Stadium",
          foundedYear: null,
          location: "Loc",
          logoUrl: null,
          rosterLimit: 53,
        }),
      );
    }
    const seasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status,
      rosterLocked: false,
    });
    return { leagueId, divisionId, teamIds, seasonId };
  });
}

describe("season CRUD (WSM-000126)", () => {
  it("setActiveSeason keeps exactly one active season per league", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await seedLeagueWithSeason(t, "active");
    // Two more seasons in the same league.
    const b = await t.mutation(internal.sports.upsertSeason, {
      name: "2027",
      leagueId,
      startDate: null,
      endDate: null,
      status: "upcoming",
    });
    await t.mutation(internal.sports.upsertSeason, {
      name: "2028",
      leagueId,
      startDate: null,
      endDate: null,
      status: "upcoming",
    });

    await t.mutation(internal.sports.setActiveSeason, {
      seasonId: b.dto.id as Id<"seasons">,
    });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("seasons")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
        .collect(),
    );
    const active = rows.filter((s) => s.status === "active");
    expect(active).toHaveLength(1);
    expect(active[0]._id).toBe(b.dto.id);
  });

  it("updateSeason renames and updates dates without touching status", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeagueWithSeason(t, "active");

    const dto = await t.mutation(internal.sports.updateSeason, {
      seasonId,
      name: "Fall 2026",
      startDate: "2026-09-01",
      endDate: "2026-12-15",
    });

    expect(dto).not.toBeNull();
    expect(dto?.name).toBe("Fall 2026");
    expect(dto?.startDate).toBe("2026-09-01");
    expect(dto?.status).toBe("active");
  });

  it("claims exactly one upcoming rollover target for a completed source", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeagueWithSeason(t, "completed");

    const first = await t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    });
    const retry = await t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    });

    expect(first.resumed).toBe(false);
    expect(retry).toMatchObject({
      resumed: true,
      targetSeasonId: first.targetSeasonId,
    });
    const target = await t.run((ctx) => ctx.db.get(first.targetSeasonId as Id<"seasons">));
    expect(target?.status).toBe("upcoming");
  });

  it("leases a rollover stage so concurrent workers cannot both run side effects", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeagueWithSeason(t, "completed");
    const rollover = await t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    });

    const first = await t.mutation(internal.sports.claimSeasonRolloverStage, {
      rolloverId: rollover.rolloverId as Id<"seasonRollovers">,
      stage: "players_progressed",
      ownerId: "worker-1",
      leaseMs: 60_000,
    });
    const second = await t.mutation(internal.sports.claimSeasonRolloverStage, {
      rolloverId: rollover.rolloverId as Id<"seasonRollovers">,
      stage: "players_progressed",
      ownerId: "worker-2",
      leaseMs: 60_000,
    });

    expect(first).toMatchObject({ acquired: true, reason: "acquired" });
    expect(second).toMatchObject({ acquired: false, reason: "busy" });
  });

  it("lets a new worker take over an expired lease and locks out the prior owner", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId } = await seedLeagueWithSeason(t, "completed");
    const rollover = await t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    });
    const rolloverId = rollover.rolloverId as Id<"seasonRollovers">;

    // worker-1 claims, then the lease expires (past expiry).
    await t.mutation(internal.sports.claimSeasonRolloverStage, {
      rolloverId,
      stage: "players_progressed",
      ownerId: "worker-1",
      leaseMs: 1_000,
    });
    await t.run((ctx) =>
      ctx.db.patch(rolloverId, {
        stageLeaseExpiresAt: new Date(Date.now() - 1_000).toISOString(),
      }),
    );

    // worker-2 takes over the expired lease.
    const takeover = await t.mutation(internal.sports.claimSeasonRolloverStage, {
      rolloverId,
      stage: "players_progressed",
      ownerId: "worker-2",
      leaseMs: 60_000,
    });
    expect(takeover).toMatchObject({ acquired: true });

    // The prior owner can neither advance nor run the staged side effect.
    await expect(
      t.mutation(internal.sports.advanceSeasonRollover, {
        rolloverId,
        stage: "players_progressed",
        ownerId: "worker-1",
      }),
    ).rejects.toThrow("rollover_stage_not_claimed");
    await expect(
      t.mutation(internal.sports.rolloverGraduateAndAdvancePlayers, {
        leagueId,
        seasonId,
        rolloverId,
        ownerId: "worker-1",
      }),
    ).rejects.toThrow("rollover_stage_not_claimed");

    // The lease holder advances exactly once; a stale retry is an idempotent
    // no-op rather than a second advancement.
    const advanced = await t.mutation(internal.sports.advanceSeasonRollover, {
      rolloverId,
      stage: "players_progressed",
      ownerId: "worker-2",
    });
    expect(advanced.stage).toBe("players_progressed");
    const retry = await t.mutation(internal.sports.advanceSeasonRollover, {
      rolloverId,
      stage: "players_progressed",
      ownerId: "worker-1",
    });
    expect(retry.stage).toBe("players_progressed");
    const state = await t.run((ctx) => ctx.db.get(rolloverId));
    expect(state?.stage).toBe("players_progressed");
    expect(state?.stageLeaseOwnerId).toBeUndefined();
  });

  it("persists and returns a stage summary for truthful downstream counts", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeagueWithSeason(t, "completed");
    const rollover = await t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    });
    const rolloverId = rollover.rolloverId as Id<"seasonRollovers">;
    const summaryJson = JSON.stringify({ progression: { snapshots: 7 } });

    const advanced = await t.mutation(internal.sports.advanceSeasonRollover, {
      rolloverId,
      stage: "players_progressed",
      summaryJson,
    });
    expect(advanced).toMatchObject({
      stage: "players_progressed",
      summaryJson,
      sourceSeasonName: "2026",
    });

    // A subsequent stage claim reads back the persisted summary verbatim.
    const claim = await t.mutation(internal.sports.claimSeasonRolloverStage, {
      rolloverId,
      stage: "attributes_copied",
      ownerId: "worker-1",
    });
    expect(claim.summaryJson).toBe(summaryJson);
  });

  it("rejects rollover before the source is completed", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeagueWithSeason(t, "active");
    await expect(t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    })).rejects.toThrow("rollover_source_not_completed");
  });

  it("enforces the newest completed source in the mutation", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId: olderId } = await seedLeagueWithSeason(t, "completed");
    await t.mutation(internal.sports.upsertSeason, {
      name: "2027",
      leagueId,
      startDate: "2027-09-01",
      endDate: null,
      status: "completed",
    });

    await expect(t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: olderId,
    })).rejects.toThrow("rollover_source_not_newest_completed");
  });

  it("does not complete an unfinished claim when its target was externally completed", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeagueWithSeason(t, "completed");
    const claim = await t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    });
    await t.run((ctx) => ctx.db.patch(claim.targetSeasonId as Id<"seasons">, {
      status: "completed",
    }));

    await expect(t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    })).rejects.toThrow("rollover_target_not_upcoming");
  });

  it("does not resume an in-progress claim whose target was activated", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeagueWithSeason(t, "completed");
    const claim = await t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    });
    await t.run((ctx) => ctx.db.patch(claim.targetSeasonId as Id<"seasons">, {
      status: "active",
    }));

    await expect(t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    })).rejects.toThrow("rollover_target_not_upcoming");
  });

  it("returns a completed claim after its target was activated", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeagueWithSeason(t, "completed");
    const claim = await t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(claim.rolloverId as Id<"seasonRollovers">, {
        status: "completed",
        stage: "completed",
        completedAt: new Date().toISOString(),
      });
      await ctx.db.patch(claim.targetSeasonId as Id<"seasons">, {
        status: "active",
      });
    });

    await expect(t.mutation(internal.sports.beginSeasonRollover, {
      sourceSeasonId: seasonId,
    })).resolves.toMatchObject({
      resumed: true,
      targetSeasonId: claim.targetSeasonId,
      status: "completed",
      stage: "completed",
    });
  });

  it("deleteSeason removes the season and cascades fixtures, results, attributes, and assignments", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, teamIds, seasonId } = await seedLeagueWithSeason(t);

    // Season-scoped children.
    await t.run(async (ctx) => {
      const playerId = await ctx.db.insert("players", {
        name: "QB1",
        leagueId,
        teamId: teamIds[0],
        position: "QB",
        positionGroup: null,
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
      });
      const fixtureId = await ctx.db.insert("fixtures", {
        seasonId,
        homeTeamId: teamIds[0],
        awayTeamId: teamIds[1],
        scheduledAt: null,
        week: 1,
        venue: null,
        status: "final",
        createdAt: "2026-01-01",
        createdBy: "actor",
      });
      await ctx.db.insert("gameResults", {
        fixtureId,
        homeScore: 21,
        awayScore: 17,
        playerStatsJson: null,
        recordedAt: "2026-01-01",
        recordedBy: "actor",
      });
      await ctx.db.insert("playerAttributes", {
        playerId,
        seasonId,
        positionGroup: "QB",
        attributesJson: "{}",
        pffSourceJson: null,
        maddenSourceJson: null,
        pffWeight: 0,
        maddenWeight: 1,
        weightedOverall: 80,
        ingestedAt: "2026-01-01",
      });
      await ctx.db.insert("rosterAssignments", {
        seasonId,
        teamId: teamIds[0],
        playerId,
        leagueId,
        depthRank: 1,
        positionSlot: "QB",
        status: "active",
        assignedAt: "2026-01-01",
        assignedBy: "actor",
      });
    });

    await t.mutation(internal.sports.deleteSeason, { seasonId });

    const counts = await t.run(async (ctx) => ({
      seasons: (await ctx.db.query("seasons").collect()).length,
      fixtures: (await ctx.db.query("fixtures").collect()).length,
      gameResults: (await ctx.db.query("gameResults").collect()).length,
      playerAttributes: (await ctx.db.query("playerAttributes").collect())
        .length,
      rosterAssignments: (await ctx.db.query("rosterAssignments").collect())
        .length,
      // The league, teams, and players must survive.
      leagues: (await ctx.db.query("leagues").collect()).length,
      teams: (await ctx.db.query("teams").collect()).length,
      players: (await ctx.db.query("players").collect()).length,
    }));

    expect(counts.seasons).toBe(0);
    expect(counts.fixtures).toBe(0);
    expect(counts.gameResults).toBe(0);
    expect(counts.playerAttributes).toBe(0);
    expect(counts.rosterAssignments).toBe(0);
    expect(counts.leagues).toBe(1);
    expect(counts.teams).toBe(2);
    expect(counts.players).toBe(1);
  });
});
