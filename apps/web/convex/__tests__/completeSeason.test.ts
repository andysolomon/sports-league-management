/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

/*
 * Season completion lifecycle (WSM-000217): completeSeason requires a decided
 * champion (or force), and a completed season is read-only for game data.
 */

interface Seeded {
  leagueId: Id<"leagues">;
  seasonId: Id<"seasons">;
  teamIds: [Id<"teams">, Id<"teams">];
  fixtureId: Id<"fixtures">;
}

async function seedSeason(
  t: ReturnType<typeof convexTest>,
  opts: { champion?: boolean } = {},
): Promise<Seeded> {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const team = (name: string) =>
      ctx.db.insert("teams", {
        name,
        leagueId,
        divisionId: null,
        city: "City",
        stadium: "Stadium",
        foundedYear: null,
        location: "Loc",
        logoUrl: null,
        rosterLimit: 53,
      });
    const teamA = await team("Alphas");
    const teamB = await team("Betas");
    const seasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: "2026-09-01",
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const fixtureId = await ctx.db.insert("fixtures", {
      seasonId,
      homeTeamId: teamA,
      awayTeamId: teamB,
      scheduledAt: null,
      week: 1,
      venue: null,
      status: "scheduled",
      createdAt: "2026-01-01",
      createdBy: "actor",
    });

    if (opts.champion) {
      const bracketId = await ctx.db.insert("playoffBrackets", {
        seasonId,
        leagueId,
        size: 2,
        rounds: 1,
        createdAt: "2026-01-01",
        createdBy: "actor",
      });
      await ctx.db.insert("playoffMatchups", {
        bracketId,
        seasonId,
        round: 1,
        slot: 0,
        homeSeed: 1,
        awaySeed: 2,
        homeTeamId: teamA,
        awayTeamId: teamB,
        nextMatchupId: null,
        nextSlot: null,
        winnerTeamId: teamA,
        fixtureId: null,
      });
    }

    return { leagueId, seasonId, teamIds: [teamA, teamB], fixtureId };
  });
}

async function seasonStatus(
  t: ReturnType<typeof convexTest>,
  seasonId: Id<"seasons">,
): Promise<string | undefined> {
  return t.run(async (ctx) => (await ctx.db.get(seasonId))?.status);
}

describe("completeSeason", () => {
  it("completes a season whose bracket has a champion", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedSeason(t, { champion: true });

    await t.mutation(internal.sports.completeSeason, { seasonId });

    expect(await seasonStatus(t, seasonId)).toBe("completed");
  });

  it("rejects without a champion", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedSeason(t);

    await expect(
      t.mutation(internal.sports.completeSeason, { seasonId }),
    ).rejects.toThrow("no_champion");
    expect(await seasonStatus(t, seasonId)).toBe("active");
  });

  it("force overrides the champion requirement", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedSeason(t);

    await t.mutation(internal.sports.completeSeason, { seasonId, force: true });

    expect(await seasonStatus(t, seasonId)).toBe("completed");
  });

  it("is idempotent on an already-completed season", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedSeason(t);

    await t.mutation(internal.sports.completeSeason, { seasonId, force: true });
    await t.mutation(internal.sports.completeSeason, { seasonId });

    expect(await seasonStatus(t, seasonId)).toBe("completed");
  });
});

describe("completed seasons are read-only for game data", () => {
  async function completedSeason(t: ReturnType<typeof convexTest>) {
    const seeded = await seedSeason(t);
    await t.mutation(internal.sports.completeSeason, {
      seasonId: seeded.seasonId,
      force: true,
    });
    return seeded;
  }

  it("recordGameResult rejects (blocks manual results and every sim path)", async () => {
    const t = convexTest(schema, modules);
    const { fixtureId } = await completedSeason(t);

    await expect(
      t.mutation(internal.sports.recordGameResult, {
        fixtureId,
        homeScore: 21,
        awayScore: 14,
        actorUserId: "actor",
      }),
    ).rejects.toThrow("season_completed");
  });

  it("createFixture rejects", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, teamIds } = await completedSeason(t);

    await expect(
      t.mutation(internal.sports.createFixture, {
        seasonId,
        homeTeamId: teamIds[0],
        awayTeamId: teamIds[1],
        scheduledAt: null,
        week: 2,
        venue: null,
        actorUserId: "actor",
      }),
    ).rejects.toThrow("season_completed");
  });

  it("generateSeasonSchedule rejects", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await completedSeason(t);

    await expect(
      t.mutation(internal.sports.generateSeasonSchedule, {
        seasonId,
        actorUserId: "actor",
      }),
    ).rejects.toThrow("season_completed");
  });

  it("generatePlayoffBracket rejects", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await completedSeason(t);

    await expect(
      t.mutation(internal.sports.generatePlayoffBracket, {
        seasonId,
        size: 2,
        actorUserId: "actor",
      }),
    ).rejects.toThrow("season_completed");
  });

  it("setActiveSeason reactivates a completed season (escape hatch)", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await completedSeason(t);

    await t.mutation(internal.sports.setActiveSeason, { seasonId });

    expect(await seasonStatus(t, seasonId)).toBe("active");
  });
});
