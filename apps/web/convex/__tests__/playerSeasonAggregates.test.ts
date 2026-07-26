/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { aggregateStatLines, parseStatLine } from "../lib/playerStats";
import {
  computeHsSprtRatings,
  positionToRatingGroup,
} from "../lib/hsSprt";

const modules = import.meta.glob("../**/*.*s");

/*
 * Integration guard for the persisted player season aggregate (F3).
 *
 * The property under test: the `playerSeasonAggregates` row always equals what
 * aggregating that player's raw `playerGameStats` rows produces. The raw
 * aggregation is the oracle, so expectations are never hand-derived.
 */

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Aggregates League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const teamId = await ctx.db.insert("teams", {
      name: "Aggregates Team",
      leagueId,
      divisionId: null,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "City",
      logoUrl: null,
      rosterLimit: 53,
    });
    const seasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const playerId = await ctx.db.insert("players", {
      name: "Marcus Hill",
      leagueId,
      teamId,
      position: "RB",
      positionGroup: "RB",
      jerseyNumber: 22,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
    });

    const fixtureIds: Id<"fixtures">[] = [];
    for (let week = 1; week <= 3; week++) {
      fixtureIds.push(
        await ctx.db.insert("fixtures", {
          seasonId,
          homeTeamId: teamId,
          awayTeamId: teamId,
          scheduledAt: null,
          week,
          venue: null,
          status: "scheduled",
          stage: "regular",
          createdAt: new Date(0).toISOString(),
          createdBy: "test",
        }),
      );
    }

    return { leagueId, teamId, seasonId, playerId, fixtureIds };
  });
}

const rushing = (yards: number, long: number) =>
  JSON.stringify({ rushing: { carries: 10, yards, td: 1, long } });

async function upsert(
  t: ReturnType<typeof convexTest>,
  args: {
    fixtureId: Id<"fixtures">;
    playerId: Id<"players">;
    teamId: Id<"teams">;
    seasonId: Id<"seasons">;
    statsJson: string;
  },
) {
  await t.mutation(internal.sports.upsertPlayerGameStats, {
    ...args,
    actorUserId: "user_test",
  });
}

/** HsRatingInput names the game count `games`, not `gamesPlayed`. */
function toRatingInput(o: { totals: ReturnType<typeof parseStatLine>; gamesPlayed: number }) {
  return { totals: o.totals, games: o.gamesPlayed };
}

/** Aggregate straight from the raw rows — the oracle. */
async function oracle(
  t: ReturnType<typeof convexTest>,
  playerId: Id<"players">,
) {
  return t.run(async (ctx) => {
    const rows = (await ctx.db.query("playerGameStats").collect()).filter(
      (r) => r.playerId === playerId,
    );
    return {
      totals: aggregateStatLines(rows.map((r) => parseStatLine(r.statsJson))),
      gamesPlayed: rows.length,
    };
  });
}

async function storedAggregate(
  t: ReturnType<typeof convexTest>,
  playerId: Id<"players">,
) {
  return t.run(async (ctx) => {
    const rows = (
      await ctx.db.query("playerSeasonAggregates").collect()
    ).filter((r) => r.playerId === playerId);
    if (rows.length === 0) return null;
    return {
      totals: parseStatLine(rows[0]!.totalsJson),
      gamesPlayed: rows[0]!.gamesPlayed,
    };
  });
}

describe("playerSeasonAggregates", () => {
  it("matches the raw aggregation after each entered line", async () => {
    const t = convexTest(schema, modules);
    const { teamId, seasonId, playerId, fixtureIds } = await seed(t);

    for (const [i, fixtureId] of fixtureIds.entries()) {
      await upsert(t, {
        fixtureId,
        playerId,
        teamId,
        seasonId,
        statsJson: rushing(80 + i * 10, 25 + i * 5),
      });
      expect(await storedAggregate(t, playerId)).toEqual(
        await oracle(t, playerId),
      );
    }

    const stored = await storedAggregate(t, playerId);
    expect(stored?.gamesPlayed).toBe(3);
  });

  it("recomputes a MAX field downward when the long run is overwritten", async () => {
    // The case a subtraction-based delta cannot handle. "long" reduces with
    // MAX, not sum: if the 55-yard game is rewritten to 12, the correct season
    // long is the next-longest remaining run (40), and no amount of arithmetic
    // on the stored 55 recovers it.
    const t = convexTest(schema, modules);
    const { teamId, seasonId, playerId, fixtureIds } = await seed(t);

    await upsert(t, {
      fixtureId: fixtureIds[0]!,
      playerId,
      teamId,
      seasonId,
      statsJson: rushing(90, 40),
    });
    await upsert(t, {
      fixtureId: fixtureIds[1]!,
      playerId,
      teamId,
      seasonId,
      statsJson: rushing(120, 55),
    });

    expect(
      (await storedAggregate(t, playerId))?.totals.rushing?.long,
    ).toBe(55);

    // Re-enter the second game with a much shorter long run.
    await upsert(t, {
      fixtureId: fixtureIds[1]!,
      playerId,
      teamId,
      seasonId,
      statsJson: rushing(120, 12),
    });

    const after = await storedAggregate(t, playerId);
    expect(after?.totals.rushing?.long).toBe(40);
    expect(after).toEqual(await oracle(t, playerId));
  });

  it("removes the row entirely when the last line is deleted", async () => {
    const t = convexTest(schema, modules);
    const { teamId, seasonId, playerId, fixtureIds } = await seed(t);

    await upsert(t, {
      fixtureId: fixtureIds[0]!,
      playerId,
      teamId,
      seasonId,
      statsJson: rushing(90, 40),
    });
    expect(await storedAggregate(t, playerId)).not.toBeNull();

    await t.mutation(internal.sports.deletePlayerGameStats, {
      fixtureId: fixtureIds[0]!,
      playerId,
    });

    expect(await storedAggregate(t, playerId)).toBeNull();
  });

  it("keeps the aggregate correct through a bulk upsert", async () => {
    const t = convexTest(schema, modules);
    const { teamId, seasonId, playerId, fixtureIds } = await seed(t);

    await t.mutation(internal.sports.bulkUpsertPlayerGameStats, {
      fixtureId: fixtureIds[0]!,
      seasonId,
      actorUserId: "user_test",
      lines: [{ playerId, teamId, statsJson: rushing(70, 33) }],
    });

    expect(await storedAggregate(t, playerId)).toEqual(
      await oracle(t, playerId),
    );
  });

  it("feeds stat leaders from live player and team rows", async () => {
    const t = convexTest(schema, modules);
    const { teamId, seasonId, playerId, fixtureIds } = await seed(t);

    await upsert(t, {
      fixtureId: fixtureIds[0]!,
      playerId,
      teamId,
      seasonId,
      statsJson: rushing(150, 60),
    });

    const leaders = await t.query(api.sports.getSeasonStatLeaders, {
      seasonId,
    });
    const rushYards = leaders.find((c) => c.key.includes("rush"));
    expect(rushYards?.leaders[0]?.playerId).toBe(playerId);
    // Name, jersey and team are joined from the LIVE rows rather than the
    // aggregate snapshot, so a rename shows up without a rebuild.
    expect(rushYards?.leaders[0]?.playerName).toBe("Marcus Hill");
    expect(rushYards?.leaders[0]?.jerseyNumber).toBe(22);
    expect(rushYards?.leaders[0]?.teamName).toBe("Aggregates Team");
  });

  it("produces SPRT ratings equal to rating the raw totals directly", async () => {
    // SPRT needs a cohort: `computeHsSprtRatings` skips any group with fewer
    // than 2 qualified players, so this seeds a second back. The assertion is
    // parity against rating the oracle totals, not merely "non-empty".
    const t = convexTest(schema, modules);
    const { leagueId, teamId, seasonId, playerId, fixtureIds } = await seed(t);

    const secondPlayerId = await t.run(async (ctx) =>
      ctx.db.insert("players", {
        name: "Devin Carter",
        leagueId,
        teamId,
        position: "RB",
        positionGroup: "RB",
        jerseyNumber: 28,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
      }),
    );

    for (const [i, fixtureId] of fixtureIds.entries()) {
      await upsert(t, {
        fixtureId,
        playerId,
        teamId,
        seasonId,
        statsJson: rushing(100 + i * 10, 30),
      });
      await upsert(t, {
        fixtureId,
        playerId: secondPlayerId,
        teamId,
        seasonId,
        statsJson: rushing(40 + i * 5, 15),
      });
    }

    const sprt = await t.query(api.sports.computeSeasonSprt, { seasonId });

    const expected = computeHsSprtRatings([
      {
        id: playerId as string,
        group: positionToRatingGroup("RB")!,
        ...toRatingInput(await oracle(t, playerId)),
      },
      {
        id: secondPlayerId as string,
        group: positionToRatingGroup("RB")!,
        ...toRatingInput(await oracle(t, secondPlayerId)),
      },
    ]);

    expect(sprt).toHaveLength(expected.size);
    for (const row of sprt) {
      const want = expected.get(row.playerId)!;
      expect(row.overall).toBe(want.overall);
      expect(row.positionGroup).toBe(want.positionGroup);
    }
    // The stronger back must rate higher — a sanity check that the join
    // did not shuffle players against their totals.
    const strong = sprt.find((r) => r.playerId === playerId)!;
    const weak = sprt.find((r) => r.playerId === secondPlayerId)!;
    expect(strong.overall).toBeGreaterThan(weak.overall);
  });

  it("backfills a season whose stat lines predate the table", async () => {
    const t = convexTest(schema, modules);
    const { teamId, seasonId, playerId, fixtureIds } = await seed(t);

    // Insert lines DIRECTLY, bypassing the mutation, so no aggregate is
    // maintained — the state prod data is in before the migration runs.
    await t.run(async (ctx) => {
      for (const [i, fixtureId] of fixtureIds.entries()) {
        await ctx.db.insert("playerGameStats", {
          fixtureId,
          playerId,
          teamId,
          seasonId,
          statsJson: rushing(60 + i * 20, 20 + i * 15),
          enteredBy: "test",
          updatedAt: new Date(0).toISOString(),
        });
      }
    });

    expect(await storedAggregate(t, playerId)).toBeNull();

    const summary = await t.mutation(
      internal.migrations["20260801_playerSeasonAggregates"]
        .backfillPlayerSeasonAggregates,
      { seasonId },
    );
    expect(summary).toEqual({ playersWritten: 1, linesCounted: 3 });

    expect(await storedAggregate(t, playerId)).toEqual(
      await oracle(t, playerId),
    );

    // Idempotent.
    await t.mutation(
      internal.migrations["20260801_playerSeasonAggregates"]
        .backfillPlayerSeasonAggregates,
      { seasonId },
    );
    expect(await storedAggregate(t, playerId)).toEqual(
      await oracle(t, playerId),
    );
  });

  it("rebuildSeasonPlayerAggregates repairs a corrupted row", async () => {
    const t = convexTest(schema, modules);
    const { teamId, seasonId, playerId, fixtureIds } = await seed(t);

    await upsert(t, {
      fixtureId: fixtureIds[0]!,
      playerId,
      teamId,
      seasonId,
      statsJson: rushing(90, 40),
    });
    const before = await storedAggregate(t, playerId);

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("playerSeasonAggregates").collect();
      for (const row of rows) {
        await ctx.db.patch(row._id, { totalsJson: "{}", gamesPlayed: 99 });
      }
    });

    await t.mutation(internal.sports.rebuildSeasonPlayerAggregates, {
      seasonId,
    });

    expect(await storedAggregate(t, playerId)).toEqual(before);
  });
});
