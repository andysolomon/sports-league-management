/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  categoryFor,
  defaultSeverity,
  gameFinalDedupeKey,
  renderHeadline,
} from "../lib/narrative";

const modules = import.meta.glob("../**/*.*s");

describe("narrative templates (pure)", () => {
  it("is deterministic — same input, byte-identical copy", () => {
    const input = {
      type: "game_final" as const,
      winnerName: "Allatoona",
      loserName: "Kennesaw Mountain",
      winnerScore: 28,
      loserScore: 21,
      tie: false,
      week: 3,
    };
    expect(renderHeadline(input)).toBe(renderHeadline(input));
  });

  it("distinguishes a nail-biter, a comfortable win and a rout", () => {
    const base = {
      type: "game_final" as const,
      winnerName: "A",
      loserName: "B",
      tie: false,
      week: null,
    };
    expect(renderHeadline({ ...base, winnerScore: 21, loserScore: 20 })).toContain(
      "edges",
    );
    expect(renderHeadline({ ...base, winnerScore: 31, loserScore: 21 })).toContain(
      "beats",
    );
    expect(renderHeadline({ ...base, winnerScore: 49, loserScore: 7 })).toContain(
      "routs",
    );
  });

  it("renders a tie without declaring a winner", () => {
    const copy = renderHeadline({
      type: "game_final",
      winnerName: "A",
      loserName: "B",
      winnerScore: 14,
      loserScore: 14,
      tie: true,
      week: 5,
    });
    expect(copy).toContain("tie");
    expect(copy).not.toMatch(/beats|edges|routs/);
  });

  it("prefixes the week only when there is one", () => {
    const withWeek = renderHeadline({
      type: "game_final",
      winnerName: "A",
      loserName: "B",
      winnerScore: 21,
      loserScore: 7,
      tie: false,
      week: 7,
    });
    const without = renderHeadline({
      type: "game_final",
      winnerName: "A",
      loserName: "B",
      winnerScore: 21,
      loserScore: 7,
      tie: false,
      week: null,
    });
    expect(withWeek.startsWith("Week 7: ")).toBe(true);
    expect(without.startsWith("Week")).toBe(false);
  });

  it("maps types to a category and a default severity", () => {
    expect(categoryFor("game_final")).toBe("game");
    expect(defaultSeverity("game_final")).toBe("info");
    expect(categoryFor("season_completed")).toBe("program");
    expect(defaultSeverity("season_completed")).toBe("headline");
  });

  it("builds a dedupe key that excludes the engine version", () => {
    // The key identifies the happening. If it ever encoded the engine version,
    // a re-sim would create a second story for the same game.
    const key = gameFinalDedupeKey("fixture_123");
    expect(key).toBe("game_final:fixture_123");
    expect(key).not.toMatch(/\d+\.\d+\.\d+/);
  });
});

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Feed League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const mk = (name: string) =>
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
      });
    const homeTeamId = await mk("Allatoona");
    const awayTeamId = await mk("Kennesaw Mountain");
    const seasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const fixtureId = await ctx.db.insert("fixtures", {
      seasonId,
      homeTeamId,
      awayTeamId,
      scheduledAt: null,
      week: 3,
      venue: null,
      status: "scheduled",
      stage: "regular",
      createdAt: new Date(0).toISOString(),
      createdBy: "test",
    });
    return { leagueId, seasonId, fixtureId, homeTeamId, awayTeamId };
  });
}

async function feed(
  t: ReturnType<typeof convexTest>,
  leagueId: Id<"leagues">,
) {
  return t.query(api.sports.listDynastyEvents, { leagueId });
}

describe("dynastyEvents", () => {
  it("records a game-final story when a result is recorded", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, fixtureId } = await seed(t);

    await t.mutation(internal.sports.recordGameResult, {
      fixtureId,
      homeScore: 28,
      awayScore: 21,
      actorUserId: "user_test",
    });

    const rows = await feed(t, leagueId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.category).toBe("game");
    expect(rows[0]!.eventType).toBe("game_final");
    expect(rows[0]!.headline).toBe(
      "Week 3: Allatoona edges Kennesaw Mountain 28-21",
    );
    expect(rows[0]!.week).toBe(3);
  });

  it("refreshes rather than duplicates when a game is re-simulated", async () => {
    // The whole point of the dedupe key: replaying a dynasty must not produce
    // a doubled newspaper, and must not leave the old scoreline asserted.
    const t = convexTest(schema, modules);
    const { leagueId, fixtureId } = await seed(t);

    await t.mutation(internal.sports.recordGameResult, {
      fixtureId,
      homeScore: 28,
      awayScore: 21,
      actorUserId: "user_test",
    });
    const first = await feed(t, leagueId);

    await t.mutation(internal.sports.recordGameResult, {
      fixtureId,
      homeScore: 7,
      awayScore: 42,
      actorUserId: "user_test",
    });
    const second = await feed(t, leagueId);

    expect(second).toHaveLength(1);
    expect(second[0]!.id).toBe(first[0]!.id);
    expect(second[0]!.headline).toBe(
      "Week 3: Kennesaw Mountain routs Allatoona 42-7",
    );
    // createdAt is preserved so refreshed copy never reorders the feed.
    expect(second[0]!.createdAt).toBe(first[0]!.createdAt);
  });

  it("keeps exactly one row per dedupe key across many replays", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, fixtureId } = await seed(t);

    for (let i = 0; i < 5; i++) {
      await t.mutation(internal.sports.recordGameResult, {
        fixtureId,
        homeScore: 20 + i,
        awayScore: 10,
        actorUserId: "user_test",
      });
    }

    const rows = await t.run(async (ctx) =>
      ctx.db.query("dynastyEvents").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(new Set(rows.map((r) => r.dedupeKey)).size).toBe(1);
  });

  it("returns newest first and filters by season and category", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, fixtureId, homeTeamId, awayTeamId } =
      await seed(t);

    const secondFixture = await t.run(async (ctx) =>
      ctx.db.insert("fixtures", {
        seasonId,
        homeTeamId: awayTeamId,
        awayTeamId: homeTeamId,
        scheduledAt: null,
        week: 4,
        venue: null,
        status: "scheduled",
        stage: "regular",
        createdAt: new Date(0).toISOString(),
        createdBy: "test",
      }),
    );

    await t.mutation(internal.sports.recordGameResult, {
      fixtureId,
      homeScore: 28,
      awayScore: 21,
      actorUserId: "user_test",
    });
    await t.mutation(internal.sports.recordGameResult, {
      fixtureId: secondFixture,
      homeScore: 35,
      awayScore: 0,
      actorUserId: "user_test",
    });

    const all = await feed(t, leagueId);
    expect(all).toHaveLength(2);
    // Descending createdAt — the later game leads the feed.
    expect(all[0]!.createdAt >= all[1]!.createdAt).toBe(true);

    const bySeason = await t.query(api.sports.listDynastyEvents, {
      leagueId,
      seasonId,
    });
    expect(bySeason).toHaveLength(2);

    const byCategory = await t.query(api.sports.listDynastyEvents, {
      leagueId,
      category: "award",
    });
    expect(byCategory).toEqual([]);
  });

  it("marks a playoff result as more notable than a regular-season one", async () => {
    const t = convexTest(schema, modules);
    const { leagueId: _leagueId, seasonId, homeTeamId, awayTeamId } =
      await seed(t);
    const leagueId = _leagueId;

    const playoffFixture = await t.run(async (ctx) =>
      ctx.db.insert("fixtures", {
        seasonId,
        homeTeamId,
        awayTeamId,
        scheduledAt: null,
        week: 12,
        venue: null,
        status: "scheduled",
        stage: "playoff",
        createdAt: new Date(0).toISOString(),
        createdBy: "test",
      }),
    );

    await t.mutation(internal.sports.recordGameResult, {
      fixtureId: playoffFixture,
      homeScore: 21,
      awayScore: 14,
      actorUserId: "user_test",
    });

    const rows = await feed(t, leagueId);
    expect(rows[0]!.severity).toBe("notable");
  });

  it("drops the feed when the season is deleted", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, seasonId, fixtureId } = await seed(t);

    await t.mutation(internal.sports.recordGameResult, {
      fixtureId,
      homeScore: 28,
      awayScore: 21,
      actorUserId: "user_test",
    });
    expect(await feed(t, leagueId)).toHaveLength(1);

    await t.mutation(internal.sports.deleteSeason, { seasonId });
    expect(await feed(t, leagueId)).toEqual([]);
  });
});
