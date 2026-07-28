/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

/*
 * Team programs (Dynasty Mode A6).
 *
 * The storage half of schemes. The engine half is covered by
 * `src/lib/pbp/__tests__/schemes.test.ts`; what matters here is that a scheme
 * survives a round trip, that setting one twice cannot produce two rows the
 * simulator would have to choose between, and that "unset" stays distinguishable
 * from "chose the balanced scheme".
 */

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Scheme League",
      orgId: "org_test",
      isPublic: false,
      inviteToken: null,
    });
    const otherLeagueId = await ctx.db.insert("leagues", {
      name: "Other League",
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
    const mkTeam = (name: string, league: typeof leagueId) =>
      ctx.db.insert("teams", {
        name,
        leagueId: league,
        divisionId: null,
        city: "City",
        stadium: "Stadium",
        foundedYear: null,
        location: "City",
        logoUrl: null,
        rosterLimit: 53,
      } as never);
    return {
      leagueId,
      seasonId,
      homeTeamId: await mkTeam("Home", leagueId),
      awayTeamId: await mkTeam("Away", leagueId),
      foreignTeamId: await mkTeam("Foreign", otherLeagueId),
    };
  });
}

describe("setTeamProgram", () => {
  it("stores a scheme and reads it back", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, homeTeamId } = await seed(t);

    await t.mutation(internal.program.setTeamProgram, {
      seasonId,
      teamId: homeTeamId,
      actorUserId: "user_admin",
      offenseScheme: "flexbone",
      defenseScheme: "forty_six",
      tempo: 30,
      blitzRate: 85,
      aggression: 75,
    });

    const program = await t.query(api.program.getTeamProgram, {
      seasonId,
      teamId: homeTeamId,
    });
    expect(program).toMatchObject({
      offenseScheme: "flexbone",
      defenseScheme: "forty_six",
      tempo: 30,
      blitzRate: 85,
      aggression: 75,
    });
  });

  it("reports an unset field as null rather than a default", async () => {
    // "Has not chosen an offense" and "runs the balanced offense" are different
    // claims. Only the second is a decision somebody made, and the UI has to be
    // able to tell them apart.
    const t = convexTest(schema, modules);
    const { seasonId, homeTeamId } = await seed(t);

    await t.mutation(internal.program.setTeamProgram, {
      seasonId,
      teamId: homeTeamId,
      actorUserId: "user_admin",
      offenseScheme: "spread",
    });

    const program = await t.query(api.program.getTeamProgram, {
      seasonId,
      teamId: homeTeamId,
    });
    expect(program?.offenseScheme).toBe("spread");
    expect(program?.defenseScheme).toBeNull();
    expect(program?.tempo).toBeNull();
    expect(program?.aggression).toBeNull();
  });

  it("returns null for a team that has chosen nothing", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, awayTeamId } = await seed(t);

    expect(
      await t.query(api.program.getTeamProgram, {
        seasonId,
        teamId: awayTeamId,
      }),
    ).toBeNull();
  });

  it("keeps exactly one row per team across repeated saves", async () => {
    // Two rows would leave the simulator choosing between them.
    const t = convexTest(schema, modules);
    const { seasonId, homeTeamId } = await seed(t);

    for (const offense of ["spread", "air_raid", "wing_t"]) {
      await t.mutation(internal.program.setTeamProgram, {
        seasonId,
        teamId: homeTeamId,
        actorUserId: "user_admin",
        offenseScheme: offense,
      });
    }

    const rows = await t.run(async (ctx) =>
      ctx.db.query("teamSeasonPrograms").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.offenseScheme).toBe("wing_t");
  });

  it("clamps dials rather than rejecting them", async () => {
    // Settings must never be able to break a simulation. A dial of 900 is a
    // slider bug, not a reason to fail a season sim.
    const t = convexTest(schema, modules);
    const { seasonId, homeTeamId } = await seed(t);

    const program = await t.mutation(internal.program.setTeamProgram, {
      seasonId,
      teamId: homeTeamId,
      actorUserId: "user_admin",
      tempo: 900,
      blitzRate: -40,
      aggression: 62.7,
    });
    expect(program.tempo).toBe(100);
    expect(program.blitzRate).toBe(0);
    expect(program.aggression).toBe(63);
  });

  it("refuses a team from another league", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, foreignTeamId } = await seed(t);

    await expect(
      t.mutation(internal.program.setTeamProgram, {
        seasonId,
        teamId: foreignTeamId,
        actorUserId: "user_admin",
        offenseScheme: "spread",
      }),
    ).rejects.toThrow("team_not_in_league");
  });
});

describe("listTeamPrograms", () => {
  it("returns every configured team in the season, and only those", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, homeTeamId, awayTeamId } = await seed(t);

    await t.mutation(internal.program.setTeamProgram, {
      seasonId,
      teamId: homeTeamId,
      actorUserId: "user_admin",
      offenseScheme: "flexbone",
    });
    await t.mutation(internal.program.setTeamProgram, {
      seasonId,
      teamId: awayTeamId,
      actorUserId: "user_admin",
      offenseScheme: "air_raid",
    });

    const programs = await t.query(api.program.listTeamPrograms, { seasonId });
    expect(programs).toHaveLength(2);
    expect(
      programs.map((p) => p.offenseScheme).sort(),
    ).toEqual(["air_raid", "flexbone"]);
  });

  it("is empty for a season nobody has configured", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seed(t);
    expect(await t.query(api.program.listTeamPrograms, { seasonId })).toEqual([]);
  });
});
