/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { computeStandingsPure } from "../lib/standings";

const modules = import.meta.glob("../**/*.*s");

/*
 * Integration guard for the persisted standings cache (F2).
 *
 * The point of this suite is a single property: the `seasonTeamRecords` table,
 * and the standings computed from it, must ALWAYS equal what the old
 * fixture-scanning implementation produced. `computeStandingsPure` is that old
 * implementation, still exercised by its own unit tests, so it is used here as
 * the independent oracle rather than re-deriving expectations by hand.
 */

async function seedLeague(
  t: ReturnType<typeof convexTest>,
  opts: { teamCount: number; divisions: number },
) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Records League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });

    const divisionIds: Id<"divisions">[] = [];
    for (let d = 0; d < opts.divisions; d++) {
      divisionIds.push(
        await ctx.db.insert("divisions", { name: `Div ${d}`, leagueId }),
      );
    }

    const teamIds: Id<"teams">[] = [];
    for (let i = 0; i < opts.teamCount; i++) {
      teamIds.push(
        await ctx.db.insert("teams", {
          // Names are deliberately NOT alphabetical by index, so a bug that
          // falls through to the name tiebreak cannot accidentally match.
          name: `Team ${String.fromCharCode(90 - i)}`,
          leagueId,
          divisionId: divisionIds.length
            ? divisionIds[i % divisionIds.length]!
            : null,
          city: "City",
          stadium: "Stadium",
          foundedYear: null,
          location: "City",
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
      status: "active",
      rosterLocked: false,
    });

    return { leagueId, seasonId, teamIds, divisionIds };
  });
}

async function addFixture(
  t: ReturnType<typeof convexTest>,
  args: {
    seasonId: Id<"seasons">;
    homeTeamId: Id<"teams">;
    awayTeamId: Id<"teams">;
    week: number;
    stage?: string;
  },
) {
  return t.run(async (ctx) =>
    ctx.db.insert("fixtures", {
      seasonId: args.seasonId,
      homeTeamId: args.homeTeamId,
      awayTeamId: args.awayTeamId,
      scheduledAt: null,
      week: args.week,
      venue: null,
      status: "scheduled",
      stage: args.stage ?? "regular",
      createdAt: new Date(0).toISOString(),
      createdBy: "test",
    }),
  );
}

async function record(
  t: ReturnType<typeof convexTest>,
  fixtureId: Id<"fixtures">,
  homeScore: number,
  awayScore: number,
) {
  await t.mutation(internal.sports.recordGameResult, {
    fixtureId,
    homeScore,
    awayScore,
    actorUserId: "user_test",
  });
}

/** Rebuild standings the old way, straight from fixtures + results. */
async function oracleStandings(
  t: ReturnType<typeof convexTest>,
  args: { leagueId: Id<"leagues">; seasonId: Id<"seasons"> },
) {
  return t.run(async (ctx) => {
    // Full collects rather than indexed reads: this is the oracle, so it should
    // be as dumb and obviously-correct as possible, and the fixtures are tiny.
    const teams = (await ctx.db.query("teams").collect()).filter(
      (tm) => tm.leagueId === args.leagueId,
    );
    const fixtures = (await ctx.db.query("fixtures").collect()).filter(
      (f) => f.seasonId === args.seasonId,
    );
    const fixtureIds = new Set(fixtures.map((f) => f._id as string));
    const results = (await ctx.db.query("gameResults").collect()).filter((r) =>
      fixtureIds.has(r.fixtureId as string),
    );

    return computeStandingsPure({
      teams: teams.map((tm) => ({
        _id: tm._id,
        name: tm.name,
        divisionId: tm.divisionId,
      })),
      fixtures: fixtures
        .filter((f) => f.stage !== "playoff")
        .map((f) => ({
          _id: f._id,
          seasonId: f.seasonId,
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          status: f.status,
        })),
      results: results.map((r) => ({
        fixtureId: r.fixtureId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
      })),
    });
  });
}

async function cachedStandings(
  t: ReturnType<typeof convexTest>,
  seasonId: Id<"seasons">,
) {
  return t.query(api.sports.computeStandings, { seasonId });
}

describe("seasonTeamRecords parity with the fixture-scanning implementation", () => {
  it("matches the oracle after a full round of results", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, teamIds } = await seedLeague(t, {
      teamCount: 4,
      divisions: 2,
    });

    const f1 = await addFixture(t, {
      seasonId,
      homeTeamId: teamIds[0]!,
      awayTeamId: teamIds[1]!,
      week: 1,
    });
    const f2 = await addFixture(t, {
      seasonId,
      homeTeamId: teamIds[2]!,
      awayTeamId: teamIds[3]!,
      week: 1,
    });
    const f3 = await addFixture(t, {
      seasonId,
      homeTeamId: teamIds[0]!,
      awayTeamId: teamIds[2]!,
      week: 2,
    });

    await record(t, f1, 24, 17);
    await record(t, f2, 10, 10);
    await record(t, f3, 3, 31);

    expect(await cachedStandings(t, seasonId)).toEqual(
      await oracleStandings(t, { leagueId, seasonId }),
    );
  });

  it("stays correct when an EARLIER game is re-recorded", async () => {
    // The case a naive additive delta gets wrong: overwriting a result must
    // subtract the old contribution, and streak/lastResults must reflect the
    // new chronology, not the order the writes happened to arrive in.
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, teamIds } = await seedLeague(t, {
      teamCount: 2,
      divisions: 1,
    });

    const week1 = await addFixture(t, {
      seasonId,
      homeTeamId: teamIds[0]!,
      awayTeamId: teamIds[1]!,
      week: 1,
    });
    const week2 = await addFixture(t, {
      seasonId,
      homeTeamId: teamIds[1]!,
      awayTeamId: teamIds[0]!,
      week: 2,
    });

    await record(t, week1, 21, 0);
    await record(t, week2, 21, 0);
    // Re-sim week 1 with the opposite outcome.
    await record(t, week1, 0, 21);

    expect(await cachedStandings(t, seasonId)).toEqual(
      await oracleStandings(t, { leagueId, seasonId }),
    );

    const records = await t.run(async (ctx) =>
      ctx.db
        .query("seasonTeamRecords")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );

    // Team 0 lost both games after the re-record: 0-2, streak -2.
    const teamZero = records.find((r) => r.teamId === teamIds[0]!)!;
    expect(teamZero.wins).toBe(0);
    expect(teamZero.losses).toBe(2);
    expect(teamZero.streak).toBe(-2);
    expect(teamZero.lastResults).toEqual(["L", "L"]);
    expect(teamZero.gamesCounted).toBe(2);
  });

  it("never counts playoff fixtures", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, teamIds } = await seedLeague(t, {
      teamCount: 2,
      divisions: 1,
    });

    const regular = await addFixture(t, {
      seasonId,
      homeTeamId: teamIds[0]!,
      awayTeamId: teamIds[1]!,
      week: 1,
    });
    const playoff = await addFixture(t, {
      seasonId,
      homeTeamId: teamIds[0]!,
      awayTeamId: teamIds[1]!,
      week: 2,
      stage: "playoff",
    });

    await record(t, regular, 20, 10);
    await record(t, playoff, 0, 50);

    const records = await t.run(async (ctx) =>
      ctx.db
        .query("seasonTeamRecords")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );

    const teamZero = records.find((r) => r.teamId === teamIds[0]!)!;
    expect(teamZero.gamesCounted).toBe(1);
    expect(teamZero.wins).toBe(1);
    expect(teamZero.losses).toBe(0);
    // The 50-point playoff blowout must not touch points either.
    expect(teamZero.pointsAgainst).toBe(10);

    expect(await cachedStandings(t, seasonId)).toEqual(
      await oracleStandings(t, { leagueId, seasonId }),
    );
  });

  it("holds under a randomized record / re-record sequence", async () => {
    // Property test: whatever order results are written and rewritten in, the
    // cache equals a rebuild from source.
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, teamIds } = await seedLeague(t, {
      teamCount: 4,
      divisions: 2,
    });

    const fixtures: Id<"fixtures">[] = [];
    let week = 1;
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        fixtures.push(
          await addFixture(t, {
            seasonId,
            homeTeamId: teamIds[i]!,
            awayTeamId: teamIds[j]!,
            week: week++,
          }),
        );
      }
    }

    // Deterministic pseudo-random sequence — a failure must be reproducible.
    let seed = 12345;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };

    for (let step = 0; step < 40; step++) {
      const fixtureId = fixtures[next() % fixtures.length]!;
      const homeScore = next() % 35;
      const awayScore = next() % 35;
      await record(t, fixtureId, homeScore, awayScore);

      expect(await cachedStandings(t, seasonId)).toEqual(
        await oracleStandings(t, { leagueId, seasonId }),
      );
    }
  });

  it("rebuildSeasonTeamRecords reproduces the same rows it repairs", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, teamIds } = await seedLeague(t, {
      teamCount: 4,
      divisions: 2,
    });

    const f1 = await addFixture(t, {
      seasonId,
      homeTeamId: teamIds[0]!,
      awayTeamId: teamIds[1]!,
      week: 1,
    });
    await record(t, f1, 14, 7);

    const before = await t.run(async (ctx) =>
      ctx.db
        .query("seasonTeamRecords")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );

    // Corrupt the cache, then repair it.
    await t.run(async (ctx) => {
      for (const row of before) {
        await ctx.db.patch(row._id, { wins: 99, pointsFor: -1, streak: 42 });
      }
    });

    await t.mutation(internal.sports.rebuildSeasonTeamRecords, { seasonId });

    const after = await t.run(async (ctx) =>
      ctx.db
        .query("seasonTeamRecords")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );

    const strip = (rows: typeof after) =>
      rows
        .map((r) => ({
          teamId: r.teamId,
          wins: r.wins,
          losses: r.losses,
          ties: r.ties,
          pointsFor: r.pointsFor,
          pointsAgainst: r.pointsAgainst,
          streak: r.streak,
          gamesCounted: r.gamesCounted,
          headToHeadJson: r.headToHeadJson,
        }))
        .sort((a, b) => a.teamId.localeCompare(b.teamId));

    expect(strip(after)).toEqual(strip(before));
    expect(await cachedStandings(t, seasonId)).toEqual(
      await oracleStandings(t, { leagueId, seasonId }),
    );
  });

  it("backfills a season whose results predate the cache", async () => {
    // The migration's real job: a league that already played games before
    // seasonTeamRecords existed. Results are inserted DIRECTLY here, bypassing
    // recordGameResult, so no cache is maintained along the way — exactly the
    // state prod data is in before the backfill runs.
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, teamIds } = await seedLeague(t, {
      teamCount: 4,
      divisions: 2,
    });

    await t.run(async (ctx) => {
      const pairs: Array<[number, number, number, number]> = [
        [0, 1, 21, 14],
        [2, 3, 7, 7],
        [0, 2, 35, 0],
        [1, 3, 3, 6],
      ];
      let week = 1;
      for (const [home, away, homeScore, awayScore] of pairs) {
        const fixtureId = await ctx.db.insert("fixtures", {
          seasonId,
          homeTeamId: teamIds[home]!,
          awayTeamId: teamIds[away]!,
          scheduledAt: null,
          week: week++,
          venue: null,
          status: "final",
          stage: "regular",
          createdAt: new Date(0).toISOString(),
          createdBy: "test",
        });
        await ctx.db.insert("gameResults", {
          fixtureId,
          homeScore,
          awayScore,
          playerStatsJson: null,
          recordedAt: new Date(0).toISOString(),
          recordedBy: "test",
        });
      }
    });

    // Standings are all-zeroes until the backfill runs — the cache is empty.
    const beforeBackfill = await cachedStandings(t, seasonId);
    expect(beforeBackfill.every((r) => r.wins === 0 && r.losses === 0)).toBe(
      true,
    );

    const summary = await t.mutation(
      internal.migrations["20260801_seasonTeamRecords"]
        .backfillSeasonTeamRecords,
      { seasonId },
    );
    expect(summary.gamesCounted).toBe(4);

    expect(await cachedStandings(t, seasonId)).toEqual(
      await oracleStandings(t, { leagueId, seasonId }),
    );

    // Idempotent: a second run changes nothing.
    await t.mutation(
      internal.migrations["20260801_seasonTeamRecords"]
        .backfillSeasonTeamRecords,
      { seasonId },
    );
    expect(await cachedStandings(t, seasonId)).toEqual(
      await oracleStandings(t, { leagueId, seasonId }),
    );
  });

  it("drops cached records when the season is deleted", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, teamIds } = await seedLeague(t, {
      teamCount: 2,
      divisions: 1,
    });

    const f1 = await addFixture(t, {
      seasonId,
      homeTeamId: teamIds[0]!,
      awayTeamId: teamIds[1]!,
      week: 1,
    });
    await record(t, f1, 14, 7);

    await t.mutation(internal.sports.deleteSeason, { seasonId });

    const remaining = await t.run(async (ctx) =>
      ctx.db
        .query("seasonTeamRecords")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );
    expect(remaining).toEqual([]);
  });
});
