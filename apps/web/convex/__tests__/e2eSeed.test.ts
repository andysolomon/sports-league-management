/// <reference types="vite/client" />
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { anyApi } from "convex/server";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

const FIXTURE_KEY = "wsm-e2e-test";

interface FixtureResult {
  fixtureKey: string;
  leagueId: Id<"leagues">;
  seasonId: Id<"seasons">;
  teamId: Id<"teams">;
  playerIds: Id<"players">[];
  activeAssignmentIds: Id<"rosterAssignments">[];
}

function asFixture(r: unknown): FixtureResult {
  return r as FixtureResult;
}

describe("e2eSeed", () => {
  const originalEnv = process.env.CONVEX_ENABLE_E2E_SEED;

  beforeEach(() => {
    process.env.CONVEX_ENABLE_E2E_SEED = "1";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CONVEX_ENABLE_E2E_SEED;
    } else {
      process.env.CONVEX_ENABLE_E2E_SEED = originalEnv;
    }
  });

  it("refuses to run when the env guard is off", async () => {
    process.env.CONVEX_ENABLE_E2E_SEED = "0";
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(anyApi.e2eSeed.createRosterFixture, {
        fixtureKey: FIXTURE_KEY,
        clerkOrgId: null,
        rosterLimit: 53,
      }),
    ).rejects.toThrow("e2e_seed_disabled");
  });

  it("creates league + season + team + bench players with no active assignments by default", async () => {
    const t = convexTest(schema, modules);
    const result = asFixture(
      await t.mutation(anyApi.e2eSeed.createRosterFixture, {
        fixtureKey: FIXTURE_KEY,
        clerkOrgId: "org_test_123",
        rosterLimit: 53,
      }),
    );

    expect(result.fixtureKey).toBe(FIXTURE_KEY);
    expect(result.playerIds).toHaveLength(2);
    expect(result.activeAssignmentIds).toHaveLength(0);

    await t.run(async (ctx) => {
      const league = await ctx.db.get(result.leagueId);
      expect(league?.name).toBe(`E2E:${FIXTURE_KEY}`);
      expect(league?.orgId).toBe("org_test_123");
      const season = await ctx.db.get(result.seasonId);
      expect(season?.rosterLocked).toBe(false);
      const team = await ctx.db.get(result.teamId);
      expect(team?.rosterLimit).toBe(53);
    });
  });

  it("pre-seeds active roster assignments when requested", async () => {
    const t = convexTest(schema, modules);
    const result = asFixture(
      await t.mutation(anyApi.e2eSeed.createRosterFixture, {
        fixtureKey: FIXTURE_KEY,
        clerkOrgId: null,
        rosterLimit: 5,
        seedActivePlayers: 3,
        extraBenchPlayers: 2,
        positionSlot: "QB",
      }),
    );

    expect(result.playerIds).toHaveLength(5);
    expect(result.activeAssignmentIds).toHaveLength(3);

    await t.run(async (ctx) => {
      const assignments = await ctx.db
        .query("rosterAssignments")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", result.seasonId).eq("teamId", result.teamId),
        )
        .collect();
      expect(assignments).toHaveLength(3);
      const ranks = assignments
        .map((row) => row.depthRank)
        .sort((a, b) => a - b);
      expect(ranks).toEqual([1, 2, 3]);
      expect(assignments.every((row) => row.status === "active")).toBe(true);
    });
  });

  it("is idempotent: re-running replaces the prior fixture", async () => {
    const t = convexTest(schema, modules);
    const first = asFixture(
      await t.mutation(anyApi.e2eSeed.createRosterFixture, {
        fixtureKey: FIXTURE_KEY,
        clerkOrgId: null,
        rosterLimit: 53,
        extraBenchPlayers: 4,
      }),
    );
    const second = asFixture(
      await t.mutation(anyApi.e2eSeed.createRosterFixture, {
        fixtureKey: FIXTURE_KEY,
        clerkOrgId: null,
        rosterLimit: 40,
        extraBenchPlayers: 1,
      }),
    );

    expect(second.leagueId).not.toBe(first.leagueId);
    expect(second.playerIds).toHaveLength(1);

    await t.run(async (ctx) => {
      const leagues = await ctx.db
        .query("leagues")
        .withIndex("by_name", (q) =>
          q.eq("name", `E2E:${FIXTURE_KEY}`),
        )
        .collect();
      expect(leagues).toHaveLength(1);
      expect(leagues[0]._id).toBe(second.leagueId);

      const team = await ctx.db.get(second.teamId);
      expect(team?.rosterLimit).toBe(40);
    });
  });

  it("respects rosterLocked=true when requested", async () => {
    const t = convexTest(schema, modules);
    const result = asFixture(
      await t.mutation(anyApi.e2eSeed.createRosterFixture, {
        fixtureKey: FIXTURE_KEY,
        clerkOrgId: null,
        rosterLimit: 53,
        rosterLocked: true,
      }),
    );

    await t.run(async (ctx) => {
      const season = await ctx.db.get(result.seasonId);
      expect(season?.rosterLocked).toBe(true);
    });
  });

  it("resetRosterFixture deletes all rows created under the fixtureKey", async () => {
    const t = convexTest(schema, modules);
    const result = asFixture(
      await t.mutation(anyApi.e2eSeed.createRosterFixture, {
        fixtureKey: FIXTURE_KEY,
        clerkOrgId: null,
        rosterLimit: 53,
        seedActivePlayers: 2,
        extraBenchPlayers: 2,
      }),
    );

    const { deleted } = (await t.mutation(
      anyApi.e2eSeed.resetRosterFixture,
      { fixtureKey: FIXTURE_KEY },
    )) as { deleted: number };
    expect(deleted).toBeGreaterThan(0);

    await t.run(async (ctx) => {
      const leagues = await ctx.db
        .query("leagues")
        .withIndex("by_name", (q) =>
          q.eq("name", `E2E:${FIXTURE_KEY}`),
        )
        .collect();
      expect(leagues).toHaveLength(0);

      const strayPlayer = await ctx.db.get(result.playerIds[0]);
      expect(strayPlayer).toBeNull();
      const strayAssignment = await ctx.db.get(result.activeAssignmentIds[0]);
      expect(strayAssignment).toBeNull();
    });
  });

  it("does not touch other leagues", async () => {
    const t = convexTest(schema, modules);

    const otherLeague = await t.run(async (ctx) =>
      ctx.db.insert("leagues", {
        name: "Real Production League",
        orgId: "org_real",
        isPublic: true,
        inviteToken: null,
      }),
    );

    await t.mutation(anyApi.e2eSeed.createRosterFixture, {
      fixtureKey: FIXTURE_KEY,
      clerkOrgId: null,
      rosterLimit: 53,
    });

    await t.mutation(anyApi.e2eSeed.resetRosterFixture, {
      fixtureKey: FIXTURE_KEY,
    });

    await t.run(async (ctx) => {
      const survived = await ctx.db.get(otherLeague);
      expect(survived?.name).toBe("Real Production League");
    });
  });
});
