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
        size: 1, // < 2 is invalid (any count ≥ 2 is now supported)
        actorUserId: "user_1",
      }),
    ).rejects.toThrow("invalid_bracket_size");

    await expect(
      t.mutation(internal.sports.generatePlayoffBracket, {
        seasonId,
        size: 8, // only 4 teams seeded
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

describe("playoff bracket — byes (WSM-flex-brackets)", () => {
  it("a 6-team bracket gives the top 2 seeds first-round byes (no fixture)", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 6);

    const res = await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 6,
      actorUserId: "user_1",
    });
    // Bracket rounds up to 8 → 3 rounds, 7 matchup nodes.
    expect(res).toMatchObject({ size: 8, rounds: 3, matchups: 7 });

    const r1 = await roundOneMatchups(t, seasonId);
    const byes = r1.filter((m) => m.awayTeamId == null && m.homeTeamId != null);
    const games = r1.filter((m) => m.awayTeamId != null);
    expect(byes).toHaveLength(2); // seeds 1 and 2 get byes
    expect(games).toHaveLength(2); // the other 4 teams play

    // Bye matchups: winner pre-set, NO fixture spawned.
    for (const b of byes) {
      expect(b.winnerTeamId).toBe(b.homeTeamId);
      expect(b.fixtureId).toBeNull();
      expect(b.homeSeed).toBeLessThanOrEqual(2);
    }
    // Bye winners are already placed into their round-2 parent slots.
    const all = await allMatchups(t, seasonId);
    const r2WithBye = all.filter(
      (m) => m.round === 2 && (m.homeTeamId != null || m.awayTeamId != null),
    );
    expect(r2WithBye.length).toBeGreaterThan(0);

    // Only the two real round-1 games spawned fixtures.
    const fixtures = await t.run(async (ctx) =>
      (await ctx.db.query("fixtures").collect()).filter(
        (f) => f.seasonId === seasonId,
      ),
    );
    expect(fixtures).toHaveLength(2);
  });

  it("a bye team advances to play the winner of its sibling round-1 game", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 6);
    await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 6,
      actorUserId: "user_1",
    });

    // Decide both real round-1 games (home wins).
    const r1 = await roundOneMatchups(t, seasonId);
    for (const m of r1.filter((x) => x.fixtureId)) {
      await t.mutation(internal.sports.recordGameResult, {
        fixtureId: m.fixtureId as Id<"fixtures">,
        homeScore: 21,
        awayScore: 7,
        actorUserId: "user_1",
      });
    }

    // Both round-2 (semifinal) matchups now have two teams + a fixture.
    const r2 = (await allMatchups(t, seasonId)).filter((m) => m.round === 2);
    expect(r2).toHaveLength(2);
    for (const m of r2) {
      expect(m.homeTeamId).not.toBeNull();
      expect(m.awayTeamId).not.toBeNull();
      expect(m.fixtureId).not.toBeNull();
    }
  });
});

describe("playoff bracket — double elimination (WSM-flex-brackets)", () => {
  it("generates winners + losers brackets and a single grand final", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);

    const res = await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 4,
      actorUserId: "user_1",
      format: "double",
    });
    // WB(3) + LB(2) + GF(1) = 6 matchups for size 4.
    expect(res).toMatchObject({ size: 4, rounds: 2, matchups: 6 });

    const all = await allMatchups(t, seasonId);
    const wb = all.filter((m) => m.bracketType === "winners");
    const lb = all.filter((m) => m.bracketType === "losers");
    const gf = all.filter((m) => m.bracketType === "grandFinal");
    expect(wb).toHaveLength(3);
    expect(lb).toHaveLength(2);
    expect(gf).toHaveLength(1);

    // WB round-1 matchups carry loser-routing into the LB.
    const wbR1 = wb.filter((m) => m.round === 1);
    for (const m of wbR1) {
      expect(m.loserNextMatchupId).not.toBeNull();
      expect(["home", "away"]).toContain(m.loserNextSlot);
    }
    // The bracket is recorded as double-elim.
    const bracket = await t.run(async (ctx) =>
      (await ctx.db.query("playoffBrackets").collect()).find(
        (b) => b.seasonId === seasonId,
      ),
    );
    expect(bracket?.format).toBe("double");
  });

  it("WB losers drop into the losers bracket and the LB resolves to the grand final", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedLeague(t, 4);
    await t.mutation(internal.sports.generatePlayoffBracket, {
      seasonId,
      size: 4,
      actorUserId: "user_1",
      format: "double",
    });

    // Play the two WB semifinals — home wins both, so two losers drop to LB r1.
    const wbSemis = (await allMatchups(t, seasonId)).filter(
      (m) => m.bracketType === "winners" && m.round === 1,
    );
    for (const m of wbSemis) {
      await t.mutation(internal.sports.recordGameResult, {
        fixtureId: m.fixtureId as Id<"fixtures">,
        homeScore: 24,
        awayScore: 10,
        actorUserId: "user_1",
      });
    }

    // LB round 1 now holds both WB losers and has a spawned fixture.
    let all = await allMatchups(t, seasonId);
    const lbR1 = all.filter((m) => m.bracketType === "losers" && m.round === 1);
    expect(lbR1).toHaveLength(1);
    expect(lbR1[0].homeTeamId).not.toBeNull();
    expect(lbR1[0].awayTeamId).not.toBeNull();
    expect(lbR1[0].fixtureId).not.toBeNull();
    // WB losers are exactly the away teams of the two semifinals.
    const wbLoserIds = new Set(wbSemis.map((m) => m.awayTeamId));
    expect(wbLoserIds.has(lbR1[0].homeTeamId)).toBe(true);
    expect(wbLoserIds.has(lbR1[0].awayTeamId)).toBe(true);

    // Decide the WB final and the LB r1 game → both feed the LB final / GF.
    const wbFinal = all.find(
      (m) => m.bracketType === "winners" && m.round === 2,
    )!;
    await t.mutation(internal.sports.recordGameResult, {
      fixtureId: wbFinal.fixtureId as Id<"fixtures">,
      homeScore: 30,
      awayScore: 13,
      actorUserId: "user_1",
    });
    await t.mutation(internal.sports.recordGameResult, {
      fixtureId: lbR1[0].fixtureId as Id<"fixtures">,
      homeScore: 17,
      awayScore: 14,
      actorUserId: "user_1",
    });

    all = await allMatchups(t, seasonId);
    const lbFinal = all.find((m) => m.bracketType === "losers" && m.round === 2)!;
    // LB final = LB r1 winner (home) vs WB final loser (away).
    expect(lbFinal.homeTeamId).toBe(lbR1[0].homeTeamId);
    expect(lbFinal.awayTeamId).toBe(wbFinal.awayTeamId);
    expect(lbFinal.fixtureId).not.toBeNull();

    // Grand final has the WB champion in the home slot already.
    const gf = all.find((m) => m.bracketType === "grandFinal")!;
    expect(gf.homeTeamId).toBe(wbFinal.homeTeamId);

    // Decide the LB final → its winner fills the grand-final away slot + a game.
    await t.mutation(internal.sports.recordGameResult, {
      fixtureId: lbFinal.fixtureId as Id<"fixtures">,
      homeScore: 20,
      awayScore: 19,
      actorUserId: "user_1",
    });
    all = await allMatchups(t, seasonId);
    const gf2 = all.find((m) => m.bracketType === "grandFinal")!;
    expect(gf2.homeTeamId).toBe(wbFinal.homeTeamId);
    expect(gf2.awayTeamId).toBe(lbFinal.homeTeamId);
    expect(gf2.fixtureId).not.toBeNull();

    // Decide the grand final → a champion (the WB champ here).
    await t.mutation(internal.sports.recordGameResult, {
      fixtureId: gf2.fixtureId as Id<"fixtures">,
      homeScore: 31,
      awayScore: 28,
      actorUserId: "user_1",
    });
    all = await allMatchups(t, seasonId);
    const champGf = all.find((m) => m.bracketType === "grandFinal")!;
    expect(champGf.winnerTeamId).toBe(wbFinal.homeTeamId);
  });
});
