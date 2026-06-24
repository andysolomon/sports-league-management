/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

/*
 * WSM-000166 regression: the player read queries map rows through toPlayerDto,
 * which returns `grade`/`squad`. Convex strict-validates return values, so if a
 * query's `returns` validator omits those fields it throws — but ONLY on a
 * non-empty roster (an empty league returns [] and validates trivially). The
 * dashboard Overview + Players pages 500'd in prod for exactly this reason.
 * These tests seed real players so the return validators are actually exercised.
 */
async function seedPlayer(
  t: ReturnType<typeof convexTest>,
  withHsFields: boolean,
) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Players League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const divisionId = await ctx.db.insert("divisions", { name: "D1", leagueId });
    const teamId = await ctx.db.insert("teams", {
      name: "Team A",
      leagueId,
      divisionId,
      city: "City",
      stadium: "Stadium",
      foundedYear: null,
      location: "Loc",
      logoUrl: null,
      rosterLimit: 53,
    });
    const playerId = await ctx.db.insert("players", {
      name: "QB One",
      leagueId,
      teamId,
      position: "QB",
      positionGroup: "QB",
      jerseyNumber: 7,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
      ...(withHsFields ? { grade: 11, squad: "Varsity" } : {}),
    });
    return { leagueId, teamId, playerId };
  });
}

describe("player read queries return-validate with a non-empty roster (WSM-000166)", () => {
  it("listPlayers succeeds and exposes grade/squad", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await seedPlayer(t, true);
    const players = await t.query(api.sports.listPlayers, {
      leagueIds: [leagueId as Id<"leagues">],
    });
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ name: "QB One", grade: 11, squad: "Varsity" });
  });

  it("listPlayers succeeds for a player WITHOUT hs fields (grade/squad null)", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await seedPlayer(t, false);
    const players = await t.query(api.sports.listPlayers, {
      leagueIds: [leagueId as Id<"leagues">],
    });
    expect(players).toHaveLength(1);
    expect(players[0].grade).toBeNull();
    expect(players[0].squad).toBeNull();
  });

  it("listPlayersByTeam and getPlayer also validate", async () => {
    const t = convexTest(schema, modules);
    const { teamId, playerId } = await seedPlayer(t, true);
    const byTeam = await t.query(api.sports.listPlayersByTeam, {
      teamId: teamId as Id<"teams">,
    });
    expect(byTeam).toHaveLength(1);
    expect(byTeam[0].grade).toBe(11);

    const one = await t.query(api.sports.getPlayer, {
      playerId: playerId as Id<"players">,
    });
    expect(one).toMatchObject({ grade: 11, squad: "Varsity" });
  });
});
