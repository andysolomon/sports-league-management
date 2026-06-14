/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

/*
 * Seed a public reference league (active season + one rated player) and an org
 * workspace that forked it — a workspace league/team/player linked back via
 * sourceLeagueId / sourceTeamId / sourcePlayerId, with NO seasons or attributes
 * of its own. This is the shape forkTeamToWorkspace produces.
 */
async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const refLeagueId = await ctx.db.insert("leagues", {
      name: "NFL",
      orgId: null,
      isPublic: true,
      inviteToken: null,
      claimable: true,
    });
    const refSeasonId = await ctx.db.insert("seasons", {
      name: "2025",
      leagueId: refLeagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const refTeamId = await ctx.db.insert("teams", {
      name: "Bills",
      leagueId: refLeagueId,
      divisionId: null,
      city: "Buffalo",
      stadium: "Highmark",
      foundedYear: null,
      location: "Buffalo",
      logoUrl: null,
      rosterLimit: 53,
    });
    const refPlayerId = await ctx.db.insert("players", {
      name: "Josh Allen",
      leagueId: refLeagueId,
      teamId: refTeamId,
      position: "QB",
      positionGroup: "QB",
      jerseyNumber: 17,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
    });
    await ctx.db.insert("playerAttributes", {
      playerId: refPlayerId,
      seasonId: refSeasonId,
      positionGroup: "QB",
      attributesJson: JSON.stringify({ THP: 99, SAC: 92 }),
      pffSourceJson: null,
      maddenSourceJson: null,
      pffWeight: 1,
      maddenWeight: 0,
      weightedOverall: 94,
      ingestedAt: "2025-09-01",
    });

    // Workspace fork — no seasons, no attributes of its own.
    const wsLeagueId = await ctx.db.insert("leagues", {
      name: "NFL",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
      sourceLeagueId: refLeagueId,
    });
    const wsTeamId = await ctx.db.insert("teams", {
      name: "Bills",
      leagueId: wsLeagueId,
      divisionId: null,
      city: "Buffalo",
      stadium: "Highmark",
      foundedYear: null,
      location: "Buffalo",
      logoUrl: null,
      rosterLimit: 53,
      ownerOrgId: "org_1",
      sourceTeamId: refTeamId,
    });
    const wsPlayerId = await ctx.db.insert("players", {
      name: "Josh Allen",
      leagueId: wsLeagueId,
      teamId: wsTeamId,
      position: "QB",
      positionGroup: "QB",
      jerseyNumber: 17,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
      sourcePlayerId: refPlayerId,
    });

    return { refTeamId, refPlayerId, wsTeamId, wsPlayerId };
  });
}

const asTeam = (id: string) => id as Id<"teams">;
const asPlayer = (id: string) => id as Id<"players">;

describe("workspace SPRT resolution (WSM-000122)", () => {
  it("resolves team snapshots for a forked team via the source season", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    const snapshots = await t.query(api.sports.getTeamAttributeSnapshots, {
      teamId: asTeam(s.wsTeamId),
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      playerId: s.wsPlayerId, // keyed by the workspace player, not the source
      weightedOverall: 94,
    });
    expect(snapshots[0].attributes).toEqual({ THP: 99, SAC: 92 });
  });

  it("resolves a single forked player's snapshot via the source season", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    const rating = await t.query(api.sports.getPlayerSeasonAttributes, {
      playerId: asPlayer(s.wsPlayerId),
    });

    expect(rating).toMatchObject({ weightedOverall: 94, positionGroup: "QB" });
    expect(rating?.attributes).toEqual({ THP: 99, SAC: 92 });
  });

  it("still resolves native (non-forked) teams from their own season", async () => {
    const t = convexTest(schema, modules);
    const s = await seed(t);

    const snapshots = await t.query(api.sports.getTeamAttributeSnapshots, {
      teamId: asTeam(s.refTeamId),
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      playerId: s.refPlayerId,
      weightedOverall: 94,
    });
  });
});
