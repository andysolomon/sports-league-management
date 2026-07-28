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
