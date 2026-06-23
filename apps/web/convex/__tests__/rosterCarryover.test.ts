/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

/**
 * Seed a league with two seasons (source older than target), two teams, and a
 * player per team. The source season gets two roster assignments + two depth
 * chart entries; the target starts empty.
 */
async function seedLeagueWithTwoSeasons(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Carryover League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const teamIds: Id<"teams">[] = [];
    const playerIds: Id<"players">[] = [];
    for (let i = 0; i < 2; i++) {
      const teamId = await ctx.db.insert("teams", {
        name: `Team ${i}`,
        leagueId,
        divisionId: null,
        city: "City",
        stadium: "Stadium",
        foundedYear: null,
        location: "Loc",
        logoUrl: null,
        rosterLimit: 53,
      });
      teamIds.push(teamId);
      playerIds.push(
        await ctx.db.insert("players", {
          name: `Player ${i}`,
          leagueId,
          teamId,
          position: "QB",
          positionGroup: null,
          jerseyNumber: null,
          dateOfBirth: null,
          status: "active",
          headshotUrl: null,
        }),
      );
    }

    // Source is the earlier season (2025); target is the later one (2026).
    const sourceSeasonId = await ctx.db.insert("seasons", {
      name: "2025",
      leagueId,
      startDate: "2025-09-01",
      endDate: "2025-12-15",
      status: "completed",
      rosterLocked: false,
    });
    const targetSeasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: "2026-09-01",
      endDate: "2026-12-15",
      status: "active",
      rosterLocked: false,
    });

    // Two assignments + two depth entries on the source season.
    for (let i = 0; i < 2; i++) {
      await ctx.db.insert("rosterAssignments", {
        seasonId: sourceSeasonId,
        teamId: teamIds[i],
        playerId: playerIds[i],
        leagueId,
        depthRank: 1,
        positionSlot: "QB",
        status: "active",
        assignedAt: "2025-09-01T00:00:00.000Z",
        assignedBy: "old_actor",
      });
      await ctx.db.insert("depthChartEntries", {
        teamId: teamIds[i],
        seasonId: sourceSeasonId,
        playerId: playerIds[i],
        positionSlot: "QB",
        sortOrder: 0,
        updatedAt: "2025-09-01T00:00:00.000Z",
      });
    }

    return { leagueId, teamIds, playerIds, sourceSeasonId, targetSeasonId };
  });
}

async function countForSeason(
  t: ReturnType<typeof convexTest>,
  seasonId: Id<"seasons">,
) {
  return t.run(async (ctx) => {
    const assignments = (
      await ctx.db.query("rosterAssignments").collect()
    ).filter((a) => a.seasonId === seasonId);
    const depth = (await ctx.db.query("depthChartEntries").collect()).filter(
      (d) => d.seasonId === seasonId,
    );
    return { assignments, depth };
  });
}

describe("copySeasonRosters (WSM-000163)", () => {
  it("clones the most recent prior season's rosters into the target", async () => {
    const t = convexTest(schema, modules);
    const { sourceSeasonId, targetSeasonId } =
      await seedLeagueWithTwoSeasons(t);

    const res = await t.mutation(internal.sports.copySeasonRosters, {
      targetSeasonId,
      actorUserId: "new_actor",
    });

    expect(res.copiedAssignments).toBe(2);
    expect(res.copiedDepthEntries).toBe(2);
    expect(res.sourceSeasonId).toBe(sourceSeasonId);

    const target = await countForSeason(t, targetSeasonId);
    expect(target.assignments).toHaveLength(2);
    expect(target.depth).toHaveLength(2);
    // Cloned rows belong to the target season and carry the new actor.
    for (const a of target.assignments) {
      expect(a.seasonId).toBe(targetSeasonId);
      expect(a.assignedBy).toBe("new_actor");
      expect(a.positionSlot).toBe("QB");
    }
    for (const d of target.depth) {
      expect(d.seasonId).toBe(targetSeasonId);
    }

    // The source season is untouched.
    const source = await countForSeason(t, sourceSeasonId);
    expect(source.assignments).toHaveLength(2);
    expect(source.depth).toHaveLength(2);
  });

  it("uses an explicit sourceSeasonId when provided", async () => {
    const t = convexTest(schema, modules);
    const { sourceSeasonId, targetSeasonId } =
      await seedLeagueWithTwoSeasons(t);

    const res = await t.mutation(internal.sports.copySeasonRosters, {
      targetSeasonId,
      sourceSeasonId,
      actorUserId: "new_actor",
    });

    expect(res.sourceSeasonId).toBe(sourceSeasonId);
    expect(res.copiedAssignments).toBe(2);
  });

  it("guards a populated target then succeeds with confirm: true", async () => {
    const t = convexTest(schema, modules);
    const { targetSeasonId } = await seedLeagueWithTwoSeasons(t);

    // First copy populates the target.
    await t.mutation(internal.sports.copySeasonRosters, {
      targetSeasonId,
      actorUserId: "new_actor",
    });

    // Re-running unconfirmed throws the guard.
    await expect(
      t.mutation(internal.sports.copySeasonRosters, {
        targetSeasonId,
        actorUserId: "new_actor",
      }),
    ).rejects.toThrow(/target_has_rosters/);

    // With confirm: true it cleanly replaces — count stays at 2 (not doubled).
    const res = await t.mutation(internal.sports.copySeasonRosters, {
      targetSeasonId,
      actorUserId: "new_actor",
      confirm: true,
    });
    expect(res.copiedAssignments).toBe(2);

    const target = await countForSeason(t, targetSeasonId);
    expect(target.assignments).toHaveLength(2);
    expect(target.depth).toHaveLength(2);
  });

  it("throws no_source_season when there is no prior season", async () => {
    const t = convexTest(schema, modules);
    const targetSeasonId = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "Lonely League",
        orgId: "org_1",
        isPublic: false,
        inviteToken: null,
      });
      return ctx.db.insert("seasons", {
        name: "2026",
        leagueId,
        startDate: null,
        endDate: null,
        status: "active",
        rosterLocked: false,
      });
    });

    await expect(
      t.mutation(internal.sports.copySeasonRosters, {
        targetSeasonId,
        actorUserId: "new_actor",
      }),
    ).rejects.toThrow(/no_source_season/);
  });
});
