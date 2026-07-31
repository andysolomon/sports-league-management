/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

async function seedLeague(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Week Rules League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const teamIds: Id<"teams">[] = [];
    for (const name of ["A", "B", "C", "D"]) {
      teamIds.push(
        await ctx.db.insert("teams", {
          name: `Team ${name}`,
          leagueId,
          divisionId: null,
          city: "City",
          stadium: "Stadium",
          foundedYear: null,
          location: "Location",
          logoUrl: null,
          rosterLimit: null,
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
    return { seasonId, teamIds };
  });
}

function createFixtureArgs(
  seasonId: Id<"seasons">,
  homeTeamId: Id<"teams">,
  awayTeamId: Id<"teams">,
  week: number | null,
) {
  return {
    seasonId,
    homeTeamId,
    awayTeamId,
    scheduledAt: null,
    week,
    venue: null,
    actorUserId: "user_1",
  };
}

describe("fixture week validation", () => {
  it("createFixture requires a valid week", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, teamIds } = await seedLeague(t);

    await expect(
      t.mutation(
        internal.sports.createFixture,
        createFixtureArgs(seasonId, teamIds[0], teamIds[1], null),
      ),
    ).rejects.toThrow("week_required");
  });

  it("createFixture rejects either candidate side when already booked", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, teamIds } = await seedLeague(t);
    await t.mutation(
      internal.sports.createFixture,
      createFixtureArgs(seasonId, teamIds[0], teamIds[1], 1),
    );

    await expect(
      t.mutation(
        internal.sports.createFixture,
        createFixtureArgs(seasonId, teamIds[0], teamIds[2], 1),
      ),
    ).rejects.toThrow("team_already_scheduled_that_week");
    await expect(
      t.mutation(
        internal.sports.createFixture,
        createFixtureArgs(seasonId, teamIds[2], teamIds[1], 1),
      ),
    ).rejects.toThrow("team_already_scheduled_that_week");
  });

  it("createFixture succeeds when both teams are free that week", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, teamIds } = await seedLeague(t);
    await t.mutation(
      internal.sports.createFixture,
      createFixtureArgs(seasonId, teamIds[0], teamIds[1], 1),
    );

    const fixture = await t.mutation(
      internal.sports.createFixture,
      createFixtureArgs(seasonId, teamIds[0], teamIds[2], 2),
    );
    expect(fixture.week).toBe(2);
  });

  it("updateFixture blocks occupied and missing weeks but allows itself", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, teamIds } = await seedLeague(t);
    const weekOne = await t.mutation(
      internal.sports.createFixture,
      createFixtureArgs(seasonId, teamIds[0], teamIds[1], 1),
    );
    const weekTwo = await t.mutation(
      internal.sports.createFixture,
      createFixtureArgs(seasonId, teamIds[0], teamIds[2], 2),
    );

    await expect(
      t.mutation(internal.sports.updateFixture, {
        fixtureId: weekTwo.id as Id<"fixtures">,
        week: 1,
      }),
    ).rejects.toThrow("team_already_scheduled_that_week");
    await expect(
      t.mutation(internal.sports.updateFixture, {
        fixtureId: weekTwo.id as Id<"fixtures">,
        week: null,
      }),
    ).rejects.toThrow("week_required");

    const resaved = await t.mutation(internal.sports.updateFixture, {
      fixtureId: weekOne.id as Id<"fixtures">,
      week: 1,
    });
    expect(resaved?.week).toBe(1);
  });
});
