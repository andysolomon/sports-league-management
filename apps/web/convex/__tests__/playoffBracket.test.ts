/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

async function seedLeague(t: ReturnType<typeof convexTest>, teamCount: number) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Playoff League",
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
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    return { leagueId, seasonId, teamIds };
  });
}

// NB: query the new playoff tables WITHOUT `.withIndex` here. With ~21 tables,
// TS truncates DataModelFromSchemaDefinition's per-table index map for the
// last-defined tables under convex-test's strict ctx, so `.withIndex("by_…")`
// won't type-check (runtime + production `*Generic` handlers are unaffected).
function allMatchups(t: ReturnType<typeof convexTest>, seasonId: Id<"seasons">) {
  return t.run(async (ctx) =>
    (await ctx.db.query("playoffMatchups").collect()).filter(
      (m) => m.seasonId === seasonId,
    ),
  );
}

async function roundOneMatchups(
  t: ReturnType<typeof convexTest>,
  seasonId: Id<"seasons">,
) {
  const ms = await allMatchups(t, seasonId);
  return ms.filter((m) => m.round === 1).sort((a, b) => a.slot - b.slot);
}

describe("playoff bracket (WSM-000164)", () => {
  it("generates a size-4 bracket: 3 matchups, round-1 fixtures spawned (stage=playoff)", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);

    const res = await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 4,
      actorUserId: "user_1",
    });
    expect(res).toMatchObject({ size: 4, rounds: 2, matchups: 3 });

    const state = await t.run(async (ctx) => {
      const ms = (await ctx.db.query("playoffMatchups").collect()).filter(
        (m) => m.seasonId === seasonId,
      );
      const fixtures = await ctx.db
        .query("fixtures")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect();
      return { ms, fixtures };
    });

    const r1 = state.ms.filter((m) => m.round === 1);
    const final = state.ms.find((m) => m.round === 2)!;
    expect(r1).toHaveLength(2);
    // Round-1 matchups have both teams + a spawned fixture; final is TBD.
    for (const m of r1) {
      expect(m.homeTeamId).not.toBeNull();
      expect(m.awayTeamId).not.toBeNull();
      expect(m.fixtureId).not.toBeNull();
      expect(m.nextMatchupId).toBe(final._id);
    }
    expect(final.homeTeamId).toBeNull();
    expect(final.fixtureId).toBeNull();
    // Exactly the 2 round-1 fixtures exist, all stage=playoff.
    expect(state.fixtures).toHaveLength(2);
    expect(state.fixtures.every((f) => f.stage === "playoff")).toBe(true);
  });

  it("auto-advances winners and spawns the final once both semis are decided", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);
    await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 4,
      actorUserId: "user_1",
    });

    const semis = await roundOneMatchups(t, seasonId);
    // Home team wins each semifinal.
    for (const m of semis) {
      await t.mutation(internal.sports.recordGameResult, {
        fixtureId: m.fixtureId as Id<"fixtures">,
        homeScore: 28,
        awayScore: 14,
        actorUserId: "user_1",
      });
    }

    const allFinal = await allMatchups(t, seasonId);
    const final = allFinal.find((m) => m.round === 2)!;
    // Both semifinal home teams advanced; the final now has both teams + fixture.
    expect(final.homeTeamId).toBe(semis[0].homeTeamId);
    expect(final.awayTeamId).toBe(semis[1].homeTeamId);
    expect(final.fixtureId).not.toBeNull();
  });

  it("a tie does not advance a winner", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);
    await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 4,
      actorUserId: "user_1",
    });
    const semis = await roundOneMatchups(t, seasonId);
    await t.mutation(internal.sports.recordGameResult, {
      fixtureId: semis[0].fixtureId as Id<"fixtures">,
      homeScore: 21,
      awayScore: 21,
      actorUserId: "user_1",
    });
    const m0 = (await allMatchups(t, seasonId)).find(
      (m) => m._id === semis[0]._id,
    )!;
    expect(m0.winnerTeamId).toBeNull();
  });

  it("playoff results never affect regular-season standings", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);
    await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 4,
      actorUserId: "user_1",
    });
    const semis = await roundOneMatchups(t, seasonId);
    await t.mutation(internal.sports.recordGameResult, {
      fixtureId: semis[0].fixtureId as Id<"fixtures">,
      homeScore: 35,
      awayScore: 0,
      actorUserId: "user_1",
    });
    const standings = await t.query(api.sports.computeStandings, {
      seasonId,
    });
    // No regular-season games → everyone 0-0 despite the playoff blowout.
    expect(standings.every((s) => s.wins === 0 && s.losses === 0)).toBe(true);
  });

  it("guards: invalid size, not enough teams, and regen with a played game", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);

    await expect(
      t.mutation(internal.sports.generatePlayoffBracket, {
        seasonId,
        size: 6,
        actorUserId: "user_1",
      }),
    ).rejects.toThrow("invalid_bracket_size");

    await expect(
      t.mutation(internal.sports.generatePlayoffBracket, {
        seasonId,
        size: 8,
        actorUserId: "user_1",
      }),
    ).rejects.toThrow("not_enough_teams");

    await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 4,
      actorUserId: "user_1",
    });
    const semis = await roundOneMatchups(t, seasonId);
    await t.mutation(internal.sports.recordGameResult, {
      fixtureId: semis[0].fixtureId as Id<"fixtures">,
      homeScore: 10,
      awayScore: 3,
      actorUserId: "user_1",
    });

    // Regenerating now is blocked unless confirmed.
    await expect(
      t.mutation(internal.sports.generatePlayoffBracket, {
        seasonId,
        size: 4,
        actorUserId: "user_1",
      }),
    ).rejects.toThrow("bracket_has_results");

    const res = await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 4,
      actorUserId: "user_1",
      confirm: true,
    });
    expect(res.matchups).toBe(3);
    // Old playoff fixtures + results were wiped; only fresh round-1 remain.
    const counts = await t.run(async (ctx) => ({
      results: (await ctx.db.query("gameResults").collect()).length,
      fixtures: (await ctx.db.query("fixtures").collect()).length,
    }));
    expect(counts.results).toBe(0);
    expect(counts.fixtures).toBe(2);
  });
});
