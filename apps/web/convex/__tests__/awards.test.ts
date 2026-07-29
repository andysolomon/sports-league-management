/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  computeSeasonAwards,
  scoreCoachSeason,
  scorePlayerSeason,
  type AwardAggregateInput,
  type AwardCoachInput,
  type AwardTeamRecordInput,
} from "../lib/awards";

const modules = import.meta.glob("../**/*.*s");

const totals = (offense: number, defense: number) =>
  JSON.stringify({
    passing: { yards: offense, td: 0, int: 0 },
    defense: { tacklesSolo: defense, tacklesAst: 0, sacks: 0, int: 0 },
  });

function pureFixture() {
  const aggregates: AwardAggregateInput[] = [
    {
      seasonId: "s1",
      teamId: "t1",
      playerId: "p-zed",
      playerName: "Zed Player",
      position: "QB",
      positionGroup: "QB",
      gamesPlayed: 10,
      totalsJson: totals(1000, 0),
      newcomerEligible: true,
    },
    {
      seasonId: "s1",
      teamId: "t2",
      playerId: "p-aaron",
      playerName: "Aaron Player",
      position: "QB",
      positionGroup: "QB",
      gamesPlayed: 10,
      totalsJson: totals(1000, 0),
      newcomerEligible: true,
    },
    {
      seasonId: "s1",
      teamId: "t2",
      playerId: "p-defense",
      playerName: "Defense Player",
      position: "LB",
      positionGroup: "LB",
      gamesPlayed: 10,
      totalsJson: totals(0, 80),
      newcomerEligible: false,
    },
  ];
  const teamRecords: AwardTeamRecordInput[] = [
    {
      teamId: "t1",
      divisionId: "d1",
      wins: 8,
      losses: 2,
      ties: 0,
      pointsFor: 300,
      pointsAgainst: 200,
    },
    {
      teamId: "t2",
      divisionId: "d1",
      wins: 8,
      losses: 2,
      ties: 0,
      pointsFor: 300,
      pointsAgainst: 200,
    },
  ];
  const coaches: AwardCoachInput[] = [
    { coachId: "c-zed", coachName: "Zed Coach", teamId: "t1" },
    { coachId: "c-aaron", coachName: "Aaron Coach", teamId: "t2" },
  ];
  return { aggregates, teamRecords, coaches };
}

async function seedAwardSeason(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Awards League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const divisionId = await ctx.db.insert("divisions", {
      name: "North",
      leagueId,
    });
    const teamIds: Id<"teams">[] = [];
    const playerIds: Id<"players">[] = [];
    const coachIds: Id<"coaches">[] = [];
    const seasonId = await ctx.db.insert("seasons", {
      name: "2031",
      leagueId,
      startDate: null,
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    for (const [index, name] of ["Zebras", "Antelopes"].entries()) {
      const teamId = await ctx.db.insert("teams", {
        name,
        leagueId,
        divisionId,
        city: "City",
        stadium: "Stadium",
        foundedYear: null,
        location: "Location",
        logoUrl: null,
        rosterLimit: 53,
      });
      teamIds.push(teamId);
      const playerName = index === 0 ? "Zed Player" : "Aaron Player";
      const playerId = await ctx.db.insert("players", {
        name: playerName,
        leagueId,
        teamId,
        position: "QB",
        positionGroup: "QB",
        jerseyNumber: index + 1,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
        grade: 9,
      });
      playerIds.push(playerId);
      await ctx.db.insert("playerSeasonAggregates", {
        leagueId,
        seasonId,
        teamId,
        playerId,
        playerName,
        newcomerEligible: true,
        position: "QB",
        positionGroup: "QB",
        gamesPlayed: 10,
        totalsJson: totals(1000, 0),
        updatedAt: new Date(0).toISOString(),
      });
      await ctx.db.insert("seasonTeamRecords", {
        leagueId,
        seasonId,
        teamId,
        divisionId,
        wins: 8,
        losses: 2,
        ties: 0,
        pointsFor: 300,
        pointsAgainst: 200,
        divisionWins: 4,
        divisionLosses: 1,
        divisionTies: 0,
        headToHeadJson: "{}",
        streak: 1,
        lastResults: ["W"],
        gamesCounted: 10,
        updatedAt: new Date(0).toISOString(),
      });
      coachIds.push(
        await ctx.db.insert("coaches", {
          leagueId,
          teamId,
          displayName: index === 0 ? "Zed Coach" : "Aaron Coach",
          role: "head_coach",
          status: "ai",
          archetype: "program_builder",
          prestige: 50,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        }),
      );
    }
    return { seasonId, teamIds, playerIds, coachIds };
  });
}

describe("computeSeasonAwards", () => {
  it("is deterministic under deliberate ties and arbitrary input order", () => {
    const input = pureFixture();
    const first = computeSeasonAwards(input);
    const second = computeSeasonAwards({
      aggregates: [...input.aggregates].reverse(),
      teamRecords: [...input.teamRecords].reverse(),
      coaches: [...input.coaches].reverse(),
    });

    expect(second).toEqual(first);
    expect(
      first.find((award) => award.type === "offensive_player_of_year")
        ?.recipientName,
    ).toBe("Aaron Player");
    expect(
      first.find((award) => award.type === "coach_of_year")?.recipientName,
    ).toBe("Aaron Coach");
  });

  it("persists scoreValues that reproduce exactly from the pure scorers", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedAwardSeason(t);
    await t.mutation(internal.history.finalizeSeasonHistory, { seasonId });

    const stored = await t.run((ctx) =>
      ctx.db
        .query("awards")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    );
    const source = await t.run(async (ctx) => ({
      aggregates: await ctx.db
        .query("playerSeasonAggregates")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
      records: await ctx.db
        .query("seasonTeamRecords")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
        .collect(),
    }));

    for (const award of stored) {
      if (award.playerId) {
        const aggregate = source.aggregates.find(
          (row) => row.playerId === award.playerId,
        )!;
        const scores = scorePlayerSeason(aggregate);
        const expected =
          award.type === "offensive_player_of_year"
            ? scores.offense
            : award.type === "defensive_player_of_year"
              ? scores.defense
              : scores.overall;
        expect(award.scoreValue).toBe(expected);
      } else {
        const record = source.records.find(
          (row) => row.teamId === award.teamId,
        )!;
        expect(award.scoreValue).toBe(scoreCoachSeason(record));
      }
    }
  });

  it("emits one replay-safe dynasty event per award", async () => {
    const t = convexTest(schema, modules);
    const { seasonId } = await seedAwardSeason(t);
    await t.mutation(internal.history.finalizeSeasonHistory, { seasonId });
    const first = await t.run(async (ctx) => ({
      awards: await ctx.db.query("awards").collect(),
      events: await ctx.db.query("dynastyEvents").collect(),
    }));
    await t.mutation(internal.history.finalizeSeasonHistory, { seasonId });
    const second = await t.run(async (ctx) => ({
      awards: await ctx.db.query("awards").collect(),
      events: await ctx.db.query("dynastyEvents").collect(),
    }));

    expect(first.events).toHaveLength(first.awards.length);
    expect(second.awards).toHaveLength(first.awards.length);
    expect(second.events).toHaveLength(first.events.length);
    expect(new Set(second.events.map((row) => row.dedupeKey)).size).toBe(
      second.events.length,
    );
  });
});
