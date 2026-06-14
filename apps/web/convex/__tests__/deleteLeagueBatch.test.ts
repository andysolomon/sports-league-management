/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

/**
 * Seed a league with `teamCount` teams, each carrying a few players plus
 * depth-chart entries and roster assignments, a division, a season, and a
 * fixture + game result — enough to exercise every branch of the cascade.
 */
async function seedLeague(
  t: ReturnType<typeof convexTest>,
  teamCount: number,
  playersPerTeam = 3,
) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Batch League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const divisionId = await ctx.db.insert("divisions", {
      name: "Div 1",
      leagueId,
    });
    const seasonId = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });

    const teamIds = [];
    for (let i = 0; i < teamCount; i++) {
      const teamId = await ctx.db.insert("teams", {
        name: `Team ${i}`,
        leagueId,
        divisionId,
        city: "City",
        stadium: "Stadium",
        foundedYear: null,
        location: "Loc",
        logoUrl: null,
        rosterLimit: 53,
      });
      teamIds.push(teamId);
      for (let p = 0; p < playersPerTeam; p++) {
        const playerId = await ctx.db.insert("players", {
          name: `P${i}-${p}`,
          leagueId,
          teamId,
          position: "QB",
          positionGroup: null,
          jerseyNumber: null,
          dateOfBirth: null,
          status: "active",
          headshotUrl: null,
        });
        await ctx.db.insert("maddenRatings", {
          playerId,
          overall: 80,
          position: "QB",
          attributesJson: "{}",
          portraitUrl: null,
          teamLogoUrl: null,
          ingestedAt: "2026-01-01",
        });
        await ctx.db.insert("rosterAssignments", {
          seasonId,
          teamId,
          playerId,
          leagueId,
          depthRank: p + 1,
          positionSlot: "QB",
          status: "active",
          assignedAt: "2026-01-01",
          assignedBy: "actor",
        });
        await ctx.db.insert("depthChartEntries", {
          teamId,
          seasonId,
          playerId,
          positionSlot: "QB",
          sortOrder: p,
          updatedAt: "2026-01-01",
        });
      }
    }

    // A fixture between the first two teams, with a result.
    if (teamIds.length >= 2) {
      const fixtureId = await ctx.db.insert("fixtures", {
        seasonId,
        homeTeamId: teamIds[0],
        awayTeamId: teamIds[1],
        scheduledAt: null,
        week: 1,
        venue: null,
        status: "final",
        createdAt: "2026-01-01",
        createdBy: "actor",
      });
      await ctx.db.insert("gameResults", {
        fixtureId,
        homeScore: 21,
        awayScore: 17,
        playerStatsJson: null,
        recordedAt: "2026-01-01",
        recordedBy: "actor",
      });
    }

    return { leagueId };
  });
}

async function countAll(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    leagues: (await ctx.db.query("leagues").collect()).length,
    teams: (await ctx.db.query("teams").collect()).length,
    players: (await ctx.db.query("players").collect()).length,
    divisions: (await ctx.db.query("divisions").collect()).length,
    seasons: (await ctx.db.query("seasons").collect()).length,
    fixtures: (await ctx.db.query("fixtures").collect()).length,
    gameResults: (await ctx.db.query("gameResults").collect()).length,
    maddenRatings: (await ctx.db.query("maddenRatings").collect()).length,
    rosterAssignments: (await ctx.db.query("rosterAssignments").collect())
      .length,
    depthChartEntries: (await ctx.db.query("depthChartEntries").collect())
      .length,
  }));
}

describe("deleteLeagueBatch", () => {
  it("returns done for a missing league (idempotent)", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await seedLeague(t, 1);
    // First drain it, then call again — second call sees no league.
    await t.mutation(api.sports.deleteLeagueBatch, { leagueId, maxTeams: 5 });
    await t.mutation(api.sports.deleteLeagueBatch, { leagueId, maxTeams: 5 });
    const again = await t.mutation(api.sports.deleteLeagueBatch, {
      leagueId,
      maxTeams: 5,
    });
    expect(again).toEqual({ done: true, teamsDeleted: 0 });
  });

  it("deletes teams in bounded batches, finishing on the sweep call", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await seedLeague(t, 5);

    // maxTeams: 2 → batches of 2, 2, 1, then a final sweep that deletes the
    // league. Loop until done, asserting batch sizes never exceed the cap.
    const teamsPerBatch: number[] = [];
    let done = false;
    let guard = 0;
    while (!done && guard++ < 50) {
      const res = await t.mutation(api.sports.deleteLeagueBatch, {
        leagueId,
        maxTeams: 2,
      });
      teamsPerBatch.push(res.teamsDeleted);
      expect(res.teamsDeleted).toBeLessThanOrEqual(2);
      done = res.done;
    }

    expect(done).toBe(true);
    // 5 teams over batches of ≤2, then a 0-team sweep that completes.
    expect(teamsPerBatch).toEqual([2, 2, 1, 0]);

    const counts = await countAll(t);
    expect(counts).toEqual({
      leagues: 0,
      teams: 0,
      players: 0,
      divisions: 0,
      seasons: 0,
      fixtures: 0,
      gameResults: 0,
      maddenRatings: 0,
      rosterAssignments: 0,
      depthChartEntries: 0,
    });
  });

  it("clears a league in one call when maxTeams covers every team", async () => {
    const t = convexTest(schema, modules);
    const { leagueId } = await seedLeague(t, 3);

    const first = await t.mutation(api.sports.deleteLeagueBatch, {
      leagueId,
      maxTeams: 10,
    });
    expect(first).toEqual({ done: false, teamsDeleted: 3 });

    const second = await t.mutation(api.sports.deleteLeagueBatch, {
      leagueId,
      maxTeams: 10,
    });
    expect(second).toEqual({ done: true, teamsDeleted: 0 });

    const counts = await countAll(t);
    expect(counts.leagues).toBe(0);
    expect(counts.players).toBe(0);
    expect(counts.maddenRatings).toBe(0);
  });
});
