/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Injury League",
      orgId: "org_test",
      isPublic: false,
      inviteToken: null,
    });
    const seasonId = await ctx.db.insert("seasons", {
      leagueId,
      name: "2027",
      status: "active",
      startDate: null,
      endDate: null,
      rosterLocked: false,
    });
    const mkTeam = (name: string) =>
      ctx.db.insert("teams", {
        name,
        leagueId,
        divisionId: null,
        city: "City",
        stadium: "Stadium",
        foundedYear: null,
        location: "City",
        logoUrl: null,
        rosterLimit: 53,
      } as never);
    const homeTeamId = await mkTeam("Home");
    const awayTeamId = await mkTeam("Away");
    const thirdTeamId = await mkTeam("Bye");
    const mkPlayer = (name: string, teamId: typeof homeTeamId) =>
      ctx.db.insert("players", {
        name,
        leagueId,
        teamId,
        position: "RB",
        positionGroup: "RB",
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
      } as never);
    const playerId = await mkPlayer("Hurt Player", homeTeamId);
    const byePlayerId = await mkPlayer("Bye Player", thirdTeamId);
    const mkFixture = async (week: number) =>
      ctx.db.insert("fixtures", {
        seasonId,
        homeTeamId,
        awayTeamId,
        scheduledAt: null,
        week,
        venue: null,
        status: "scheduled",
        stage: "regular",
        createdAt: new Date(0).toISOString(),
        createdBy: "test",
      } as never);
    return {
      leagueId,
      seasonId,
      homeTeamId,
      awayTeamId,
      thirdTeamId,
      playerId,
      byePlayerId,
      fixtures: [await mkFixture(1), await mkFixture(2), await mkFixture(3), await mkFixture(4)],
    };
  });
}

describe("recordGameInjuries", () => {
  it("records an injury and projects a return week", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);
    const result = await t.mutation(internal.sim.recordGameInjuries, {
      fixtureId: s.fixtures[0],
      seasonId: s.seasonId,
      leagueId: s.leagueId,
      week: 1,
      homeTeamId: s.homeTeamId,
      awayTeamId: s.awayTeamId,
      injuries: [
        {
          playerId: s.playerId,
          teamId: s.homeTeamId,
          severity: "major",
          label: "Out multiple weeks",
          gamesOut: 3,
        },
      ],
    });
    expect(result.recorded).toBe(1);

    const rows = await t.query(api.sim.listActiveInjuries, {
      seasonId: s.seasonId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].gamesOut).toBe(3);
    expect(rows[0].initialGamesOut).toBe(3);
    expect(rows[0].returnsAfterWeek).toBe(4);
    expect(rows[0].status).toBe("out");
  });

  it("decrements exactly once per team game, and heals on the right one", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);
    const record = (fixtureIndex: number, week: number, injuries: unknown[] = []) =>
      t.mutation(internal.sim.recordGameInjuries, {
        fixtureId: s.fixtures[fixtureIndex],
        seasonId: s.seasonId,
        leagueId: s.leagueId,
        week,
        homeTeamId: s.homeTeamId,
        awayTeamId: s.awayTeamId,
        injuries: injuries as never,
      });

    await record(0, 1, [
      {
        playerId: s.playerId,
        teamId: s.homeTeamId,
        severity: "moderate",
        label: "Week to week",
        gamesOut: 2,
      },
    ]);

    const remaining = async () => {
      const rows = await t.query(api.sim.listActiveInjuries, {
        seasonId: s.seasonId,
      });
      return rows[0]?.gamesOut ?? null;
    };

    expect(await remaining()).toBe(2);
    await record(1, 2);
    expect(await remaining()).toBe(1);
    const second = await record(2, 3);
    // The game that takes him to zero is the one that heals him.
    expect(second.healed).toBe(1);
    expect(await remaining()).toBeNull();

    // And he does not go negative on subsequent games.
    const fourth = await record(3, 4);
    expect(fourth.healed).toBe(0);
  });

  it("does not tick the countdown twice when a game is re-simulated", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);
    const injure = () =>
      t.mutation(internal.sim.recordGameInjuries, {
        fixtureId: s.fixtures[0],
        seasonId: s.seasonId,
        leagueId: s.leagueId,
        week: 1,
        homeTeamId: s.homeTeamId,
        awayTeamId: s.awayTeamId,
        injuries: [
          {
            playerId: s.playerId,
            teamId: s.homeTeamId,
            severity: "major",
            label: "Out multiple weeks",
            gamesOut: 4,
          },
        ],
      });

    await injure();
    await injure();
    await injure();

    const rows = await t.query(api.sim.listActiveInjuries, {
      seasonId: s.seasonId,
    });
    // Replaced, not accumulated — and the countdown untouched by the replays.
    expect(rows).toHaveLength(1);
    expect(rows[0].gamesOut).toBe(4);
  });

  it("does not heal a team that did not play", async () => {
    /*
     * The games-not-weeks rule. A team on a bye keeps its injured players out —
     * decrementing league-wide would quietly shorten every absence.
     */
    const t = convexTest(schema, modules);
    const s = await seed(t);
    await t.run(async (ctx) => {
      const now = new Date().toISOString();
      await ctx.db.insert("playerInjuries", {
        leagueId: s.leagueId,
        seasonId: s.seasonId,
        teamId: s.thirdTeamId,
        playerId: s.byePlayerId,
        fixtureId: s.fixtures[3],
        severity: "moderate",
        label: "Week to week",
        gamesOut: 2,
        initialGamesOut: 2,
        weekOccurred: 1,
        returnsAfterWeek: 3,
        status: "out",
        createdAt: now,
        updatedAt: now,
      });
    });

    await t.mutation(internal.sim.recordGameInjuries, {
      fixtureId: s.fixtures[0],
      seasonId: s.seasonId,
      leagueId: s.leagueId,
      week: 1,
      homeTeamId: s.homeTeamId,
      awayTeamId: s.awayTeamId,
      injuries: [],
    });

    const bye = await t.query(api.sim.listTeamInjuries, {
      teamId: s.thirdTeamId,
      seasonId: s.seasonId,
    });
    expect(bye[0].gamesOut).toBe(2);
  });

  it("emits exactly one event per injury, and none on a re-sim", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);
    const injure = () =>
      t.mutation(internal.sim.recordGameInjuries, {
        fixtureId: s.fixtures[0],
        seasonId: s.seasonId,
        leagueId: s.leagueId,
        week: 1,
        homeTeamId: s.homeTeamId,
        awayTeamId: s.awayTeamId,
        injuries: [
          {
            playerId: s.playerId,
            teamId: s.homeTeamId,
            severity: "major",
            label: "Out multiple weeks",
            gamesOut: 3,
          },
        ],
      });

    await injure();
    await injure();

    const events = await t.run(async (ctx) =>
      ctx.db.query("dynastyEvents").collect(),
    );
    const injuryEvents = events.filter((e) => e.eventType === "player_injured");
    expect(injuryEvents).toHaveLength(1);
    expect(injuryEvents[0].headline).toContain("Hurt Player");
  });

  it("records a day-to-day knock as already healed", async () => {
    // gamesOut 0 means he is available next week — it should never sit in the
    // active list waiting for a decrement that would take it negative.
    const t = convexTest(schema, modules);
    const s = await seed(t);
    await t.mutation(internal.sim.recordGameInjuries, {
      fixtureId: s.fixtures[0],
      seasonId: s.seasonId,
      leagueId: s.leagueId,
      week: 1,
      homeTeamId: s.homeTeamId,
      awayTeamId: s.awayTeamId,
      injuries: [
        {
          playerId: s.playerId,
          teamId: s.homeTeamId,
          severity: "minor",
          label: "Day to day",
          gamesOut: 0,
        },
      ],
    });

    expect(
      await t.query(api.sim.listActiveInjuries, { seasonId: s.seasonId }),
    ).toHaveLength(0);
    expect(
      await t.query(api.sim.listTeamInjuries, {
        teamId: s.homeTeamId,
        seasonId: s.seasonId,
      }),
    ).toHaveLength(1);
  });
});

describe("healSeasonInjuries (B2)", () => {
  /** Put one open injury on the board for `teamId`, owing `gamesOut` games. */
  async function openInjury(
    t: ReturnType<typeof convexTest>,
    s: Awaited<ReturnType<typeof seed>>,
    input: {
      teamId: typeof s.homeTeamId;
      playerId: typeof s.playerId;
      fixtureId: typeof s.fixtures[number];
      gamesOut: number;
      seasonId?: typeof s.seasonId;
    },
  ) {
    await t.run(async (ctx) => {
      const now = new Date().toISOString();
      await ctx.db.insert("playerInjuries", {
        leagueId: s.leagueId,
        seasonId: input.seasonId ?? s.seasonId,
        teamId: input.teamId,
        playerId: input.playerId,
        fixtureId: input.fixtureId,
        severity: "major",
        label: "Season ending",
        gamesOut: input.gamesOut,
        initialGamesOut: input.gamesOut,
        weekOccurred: 9,
        returnsAfterWeek: 9 + input.gamesOut,
        status: "out",
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  it("closes every open injury for the season and leaves none out", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);
    await openInjury(t, s, {
      teamId: s.homeTeamId,
      playerId: s.playerId,
      fixtureId: s.fixtures[0],
      gamesOut: 6,
    });
    await openInjury(t, s, {
      teamId: s.thirdTeamId,
      playerId: s.byePlayerId,
      fixtureId: s.fixtures[1],
      gamesOut: 2,
    });

    const result = await t.mutation(internal.sim.healSeasonInjuries, {
      seasonId: s.seasonId,
    });

    expect(result.healed).toBe(2);
    expect(
      await t.query(api.sim.listActiveInjuries, { seasonId: s.seasonId }),
    ).toHaveLength(0);
  });

  it("preserves gamesOut so an offseason heal stays distinguishable", async () => {
    /*
     * The whole audit trail. A row healed by PLAYING reaches zero games owed;
     * a row healed by the OFFSEASON still owes six. Zeroing the countdown would
     * erase the difference and make a season-ending injury indistinguishable
     * from one the player came back from in Week 12.
     */
    const t = convexTest(schema, modules);
    const s = await seed(t);
    await openInjury(t, s, {
      teamId: s.homeTeamId,
      playerId: s.playerId,
      fixtureId: s.fixtures[0],
      gamesOut: 6,
    });

    await t.mutation(internal.sim.healSeasonInjuries, { seasonId: s.seasonId });

    const rows = await t.query(api.sim.listTeamInjuries, {
      teamId: s.homeTeamId,
      seasonId: s.seasonId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("healed");
    expect(rows[0].gamesOut).toBe(6);
    expect(rows[0].initialGamesOut).toBe(6);
  });

  it("is idempotent — a second run heals nothing and changes nothing", async () => {
    /*
     * The stage runs under a 60-second lease, so a lost response is retried.
     * Re-running must be a no-op rather than a second pass that re-stamps
     * `updatedAt` on rows it already closed.
     */
    const t = convexTest(schema, modules);
    const s = await seed(t);
    await openInjury(t, s, {
      teamId: s.homeTeamId,
      playerId: s.playerId,
      fixtureId: s.fixtures[0],
      gamesOut: 4,
    });

    const first = await t.mutation(internal.sim.healSeasonInjuries, {
      seasonId: s.seasonId,
    });
    const afterFirst = await t.query(api.sim.listTeamInjuries, {
      teamId: s.homeTeamId,
      seasonId: s.seasonId,
    });

    const second = await t.mutation(internal.sim.healSeasonInjuries, {
      seasonId: s.seasonId,
    });
    const afterSecond = await t.query(api.sim.listTeamInjuries, {
      teamId: s.homeTeamId,
      seasonId: s.seasonId,
    });

    expect(first.healed).toBe(1);
    expect(second.healed).toBe(0);
    expect(afterSecond).toEqual(afterFirst);
  });

  it("leaves another season's open injuries alone", async () => {
    /*
     * Healing is scoped to the season being closed. A league mid-rollover on
     * its 2027 season must not clear injuries a 2028 season already carries.
     */
    const t = convexTest(schema, modules);
    const s = await seed(t);
    const otherSeasonId = await t.run(async (ctx) =>
      ctx.db.insert("seasons", {
        leagueId: s.leagueId,
        name: "2028",
        status: "upcoming",
        startDate: null,
        endDate: null,
        rosterLocked: false,
      }),
    );
    await openInjury(t, s, {
      teamId: s.homeTeamId,
      playerId: s.playerId,
      fixtureId: s.fixtures[0],
      gamesOut: 3,
    });
    await openInjury(t, s, {
      teamId: s.homeTeamId,
      playerId: s.playerId,
      fixtureId: s.fixtures[1],
      gamesOut: 5,
      seasonId: otherSeasonId,
    });

    const result = await t.mutation(internal.sim.healSeasonInjuries, {
      seasonId: s.seasonId,
    });

    expect(result.healed).toBe(1);
    expect(
      await t.query(api.sim.listActiveInjuries, { seasonId: otherSeasonId }),
    ).toHaveLength(1);
  });

  it("leaves a season-ending injury rostered and available in the new season", async () => {
    /*
     * The claim the stage exists to make. A player who tore an ACL in Week 3
     * carries a six-game debt into an archive that will never play those games;
     * next season he is on the roster and the sim sees nobody owing anything.
     *
     * Availability is read from the TARGET season's open injuries, which is why
     * this asserts on `listActiveInjuries(next)` rather than on the row itself:
     * that query is exactly what `loadSeasonSimContext` calls before it picks
     * participants.
     */
    const t = convexTest(schema, modules);
    const s = await seed(t);
    await openInjury(t, s, {
      teamId: s.homeTeamId,
      playerId: s.playerId,
      fixtureId: s.fixtures[0],
      gamesOut: 6,
    });

    const nextSeasonId = await t.run(async (ctx) => {
      const next = await ctx.db.insert("seasons", {
        leagueId: s.leagueId,
        name: "2028",
        status: "upcoming",
        startDate: null,
        endDate: null,
        rosterLocked: false,
      });
      // What the `rosters_copied` stage produces: the player carried forward.
      await ctx.db.insert("rosterAssignments", {
        seasonId: next,
        teamId: s.homeTeamId,
        playerId: s.playerId,
        leagueId: s.leagueId,
        depthRank: 1,
        positionSlot: "RB",
        status: "active",
        assignedAt: new Date().toISOString(),
        assignedBy: "test",
      });
      return next;
    });

    await t.mutation(internal.sim.healSeasonInjuries, { seasonId: s.seasonId });

    expect(
      await t.query(api.sim.listActiveInjuries, { seasonId: nextSeasonId }),
    ).toHaveLength(0);
    const roster = await t.run(async (ctx) =>
      ctx.db
        .query("rosterAssignments")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", nextSeasonId).eq("teamId", s.homeTeamId),
        )
        .collect(),
    );
    expect(roster.map((row) => row.playerId)).toContain(s.playerId);
  });

  it("heals nothing when a season had no injuries", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);
    const result = await t.mutation(internal.sim.healSeasonInjuries, {
      seasonId: s.seasonId,
    });
    expect(result.healed).toBe(0);
  });
});
