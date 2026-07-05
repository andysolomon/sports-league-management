/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const modules = import.meta.glob("../**/*.*s");

/** Seed a season with one fixture and one row in every cascaded table (WSM-000209). */
async function seedSeasonWithCascadeChildren(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Cascade League",
      orgId: "org_1",
      isPublic: false,
      inviteToken: null,
    });
    const divisionId = await ctx.db.insert("divisions", {
      name: "Div 1",
      leagueId,
    });
    const teamIds: Id<"teams">[] = [];
    for (let i = 0; i < 2; i++) {
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
    const playerId = await ctx.db.insert("players", {
      name: "QB1",
      leagueId,
      teamId: teamIds[0],
      position: "QB",
      positionGroup: null,
      jerseyNumber: null,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
    });
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
    await ctx.db.insert("playerGameStats", {
      fixtureId,
      playerId,
      teamId: teamIds[0],
      seasonId,
      statsJson: "{}",
      enteredBy: "actor",
      updatedAt: "2026-01-01",
    });
    await ctx.db.insert("gamePlayLogs", {
      fixtureId,
      seasonId,
      logJson: "{}",
      engineVersion: "v1",
      createdAt: "2026-01-01",
      createdBy: "actor",
    });
    await ctx.db.insert("gameStreams", {
      fixtureId,
      status: "ended",
      vodAssetId: null,
      startedBy: "actor",
      startedAt: "2026-01-01",
      endedAt: "2026-01-01",
      maxDurationMinutes: 120,
    });
    await ctx.db.insert("liveGameState", {
      fixtureId,
      homeScore: 21,
      awayScore: 17,
      period: 4,
      clock: null,
      status: "final",
      startedBy: "actor",
      startedAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
    await ctx.db.insert("depthChartEntries", {
      teamId: teamIds[0],
      seasonId,
      playerId,
      positionSlot: "QB",
      sortOrder: 1,
      updatedAt: "2026-01-01",
    });
    await ctx.db.insert("playerAttributes", {
      playerId,
      seasonId,
      positionGroup: "QB",
      attributesJson: "{}",
      pffSourceJson: null,
      maddenSourceJson: null,
      pffWeight: 0,
      maddenWeight: 1,
      weightedOverall: 80,
      ingestedAt: "2026-01-01",
    });
    await ctx.db.insert("rosterAssignments", {
      seasonId,
      teamId: teamIds[0],
      playerId,
      leagueId,
      depthRank: 1,
      positionSlot: "QB",
      status: "active",
      assignedAt: "2026-01-01",
      assignedBy: "actor",
    });
    const bracketId = await ctx.db.insert("playoffBrackets", {
      seasonId,
      leagueId,
      size: 4,
      rounds: 2,
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
      homeTeamId: teamIds[0],
      awayTeamId: teamIds[1],
      nextMatchupId: null,
      nextSlot: null,
      winnerTeamId: null,
      fixtureId: null,
    });
    const auditLogId = await ctx.db.insert("rosterAuditLog", {
      leagueId,
      teamId: teamIds[0],
      seasonId,
      actorUserId: "actor",
      action: "assign",
      beforeJson: null,
      afterJson: "{}",
      createdAt: "2026-01-01",
    });

    return { leagueId, seasonId, fixtureId, auditLogId };
  });
}

async function countSeasonScopedRows(
  t: ReturnType<typeof convexTest>,
  seasonId: Id<"seasons">,
  fixtureId: Id<"fixtures">,
) {
  return t.run(async (ctx) => {
    const allFixtures = (await ctx.db.query("fixtures").collect()).filter(
      (f) => f.seasonId === seasonId,
    );
    const allGameResults = (await ctx.db.query("gameResults").collect()).filter(
      (r) => r.fixtureId === fixtureId,
    );
    const allPlayerGameStats = (
      await ctx.db.query("playerGameStats").collect()
    ).filter((r) => r.seasonId === seasonId || r.fixtureId === fixtureId);
    const allGamePlayLogs = (await ctx.db.query("gamePlayLogs").collect()).filter(
      (r) => r.seasonId === seasonId || r.fixtureId === fixtureId,
    );
    const allGameStreams = (await ctx.db.query("gameStreams").collect()).filter(
      (r) => r.fixtureId === fixtureId,
    );
    const allLiveGameState = (
      await ctx.db.query("liveGameState").collect()
    ).filter((r) => r.fixtureId === fixtureId);
    const allDepthChart = (
      await ctx.db.query("depthChartEntries").collect()
    ).filter((r) => r.seasonId === seasonId);
    const allPlayerAttributes = (
      await ctx.db.query("playerAttributes").collect()
    ).filter((r) => r.seasonId === seasonId);
    const allRosterAssignments = (
      await ctx.db.query("rosterAssignments").collect()
    ).filter((r) => r.seasonId === seasonId);
    const allPlayoffBrackets = (
      await ctx.db.query("playoffBrackets").collect()
    ).filter((r) => r.seasonId === seasonId);
    const allPlayoffMatchups = (
      await ctx.db.query("playoffMatchups").collect()
    ).filter((r) => r.seasonId === seasonId);
    const seasons = (await ctx.db.query("seasons").collect()).filter(
      (s) => s._id === seasonId,
    );
    const auditRows = (await ctx.db.query("rosterAuditLog").collect()).filter(
      (r) => r.seasonId === seasonId,
    );

    return {
      seasons: seasons.length,
      fixtures: allFixtures.length,
      gameResults: allGameResults.length,
      playerGameStats: allPlayerGameStats.length,
      gamePlayLogs: allGamePlayLogs.length,
      gameStreams: allGameStreams.length,
      liveGameState: allLiveGameState.length,
      depthChartEntries: allDepthChart.length,
      playerAttributes: allPlayerAttributes.length,
      rosterAssignments: allRosterAssignments.length,
      playoffBrackets: allPlayoffBrackets.length,
      playoffMatchups: allPlayoffMatchups.length,
      rosterAuditLog: auditRows.length,
    };
  });
}

describe("deleteSeason cascade (WSM-000209)", () => {
  it("removes all season-scoped rows but retains rosterAuditLog", async () => {
    const t = convexTest(schema, modules);
    const { seasonId, fixtureId, auditLogId } =
      await seedSeasonWithCascadeChildren(t);

    await t.mutation(internal.sports.deleteSeason, { seasonId });

    const counts = await countSeasonScopedRows(t, seasonId, fixtureId);
    expect(counts.seasons).toBe(0);
    expect(counts.fixtures).toBe(0);
    expect(counts.gameResults).toBe(0);
    expect(counts.playerGameStats).toBe(0);
    expect(counts.gamePlayLogs).toBe(0);
    expect(counts.gameStreams).toBe(0);
    expect(counts.liveGameState).toBe(0);
    expect(counts.depthChartEntries).toBe(0);
    expect(counts.playerAttributes).toBe(0);
    expect(counts.rosterAssignments).toBe(0);
    expect(counts.playoffBrackets).toBe(0);
    expect(counts.playoffMatchups).toBe(0);
    expect(counts.rosterAuditLog).toBe(1);

    const audit = await t.run((ctx) => ctx.db.get(auditLogId));
    expect(audit).not.toBeNull();
    expect(audit?.seasonId).toBe(seasonId);
  });

  it("succeeds idempotently when the season has no related records", async () => {
    const t = convexTest(schema, modules);
    const seasonId = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "Empty League",
        orgId: "org_1",
        isPublic: false,
        inviteToken: null,
      });
      return ctx.db.insert("seasons", {
        name: "2026",
        leagueId,
        startDate: null,
        endDate: null,
        status: "upcoming",
        rosterLocked: false,
      });
    });

    await t.mutation(internal.sports.deleteSeason, { seasonId });
    await t.mutation(internal.sports.deleteSeason, { seasonId });

    const remaining = await t.run(async (ctx) =>
      (await ctx.db.query("seasons").collect()).filter((s) => s._id === seasonId),
    );
    expect(remaining).toHaveLength(0);
  });
});
