/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

/** Seed a league + season with `teamCount` teams; return the ids. */
async function seedLeague(
  t: ReturnType<typeof convexTest>,
  teamCount: number,
  startDate: string | null = null,
) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Schedule League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const divisionId = await ctx.db.insert("divisions", {
      name: "Div 1",
      leagueId,
    });
    const teamIds: Id<"teams">[] = [];
    for (let i = 0; i < teamCount; i++) {
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
      startDate,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    return { leagueId, seasonId, teamIds };
  });
}

function countFixtures(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) =>
    (await ctx.db.query("fixtures").collect()).length,
  );
}

describe("generateSeasonSchedule (WSM-000153)", () => {
  it("creates C(n,2) scheduled fixtures with week numbers and null dates", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 6);

    const res = await t.mutation(internal.sports.generateSeasonSchedule, {
      seasonId,
      actorUserId: "user_1",
    });

    expect(res.teamCount).toBe(6);
    expect(res.created).toBe(15); // C(6,2)
    expect(res.weeks).toBe(5); // n-1

    const fixtures = await t.run((ctx) =>
      ctx.db.query("fixtures").collect(),
    );
    expect(fixtures).toHaveLength(15);
    for (const f of fixtures) {
      expect(f.status).toBe("scheduled");
      expect(f.scheduledAt).toBeNull();
      expect(f.venue).toBeNull();
      expect(f.week).toBeGreaterThanOrEqual(1);
      expect(f.createdBy).toBe("user_1");
    }
  });

  it("dates fixtures off the season start (+7d/week) when startDate is set", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4, "2026-09-05");

    await t.mutation(internal.sports.generateSeasonSchedule, {
      seasonId,
      actorUserId: "user_1",
    });

    const fixtures = await t.run((ctx) =>
      ctx.db.query("fixtures").collect(),
    );
    const dateByWeek: Record<number, string> = {
      1: "2026-09-05T00:00:00.000Z",
      2: "2026-09-12T00:00:00.000Z",
      3: "2026-09-19T00:00:00.000Z",
    };
    for (const f of fixtures) {
      expect(f.scheduledAt).toBe(dateByWeek[f.week as number]);
    }
    // All games in a week share one date.
    const wk1 = fixtures.filter((f) => f.week === 1).map((f) => f.scheduledAt);
    expect(new Set(wk1).size).toBe(1);
  });

  it("throws when the league has fewer than two teams", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 1);
    await expect(
      t.mutation(internal.sports.generateSeasonSchedule, {
        seasonId,
        actorUserId: "user_1",
      }),
    ).rejects.toThrow("need_at_least_two_teams");
  });

  it("regenerates freely while all fixtures are unplayed", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);

    await t.mutation(internal.sports.generateSeasonSchedule, {
      seasonId,
      actorUserId: "user_1",
    });
    expect(await countFixtures(t)).toBe(6);

    // Second run replaces rather than appends.
    const res = await t.mutation(internal.sports.generateSeasonSchedule, {
      seasonId,
      actorUserId: "user_1",
    });
    expect(res.created).toBe(6);
    expect(await countFixtures(t)).toBe(6);
  });

  it("blocks regeneration once a fixture has a recorded result", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);

    await t.mutation(internal.sports.generateSeasonSchedule, {
      seasonId,
      actorUserId: "user_1",
    });

    // Record a result on the first fixture.
    await t.run(async (ctx) => {
      const first = await ctx.db
        .query("fixtures")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .first();
      await ctx.db.insert("gameResults", {
        fixtureId: first!._id,
        homeScore: 14,
        awayScore: 7,
        playerStatsJson: null,
        recordedAt: "2026-01-01",
        recordedBy: "user_1",
      });
    });

    await expect(
      t.mutation(internal.sports.generateSeasonSchedule, {
        seasonId,
        actorUserId: "user_1",
      }),
    ).rejects.toThrow("schedule_has_results");

    // Confirm overrides the guard and wipes the result with the old slate.
    const res = await t.mutation(internal.sports.generateSeasonSchedule, {
      seasonId,
      actorUserId: "user_1",
      confirm: true,
    });
    expect(res.created).toBe(6);
    const results = await t.run((ctx) =>
      ctx.db.query("gameResults").collect(),
    );
    expect(results).toHaveLength(0);
  });

  it("blocks regeneration when a fixture has live game state", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);

    await t.mutation(internal.sports.generateSeasonSchedule, {
      seasonId,
      actorUserId: "user_1",
    });

    await t.run(async (ctx) => {
      const first = await ctx.db
        .query("fixtures")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .first();
      await ctx.db.insert("liveGameState", {
        fixtureId: first!._id,
        homeScore: 0,
        awayScore: 0,
        period: 1,
        clock: "12:00",
        status: "in_progress",
        startedBy: "user_1",
        startedAt: "2026-01-01",
        updatedAt: "2026-01-01",
      });
    });

    await expect(
      t.mutation(internal.sports.generateSeasonSchedule, {
        seasonId,
        actorUserId: "user_1",
      }),
    ).rejects.toThrow("schedule_has_results");
  });
});
