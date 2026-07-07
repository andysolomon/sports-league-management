/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { teamOnClock } from "../lib/draft";

const modules = import.meta.glob("../**/*.*s");

const ACTOR = "user_draft_actor";

async function seedDraftLeague(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Draft League",
      orgId: null,
      isPublic: true,
      inviteToken: null,
    });
    const teamWinner = await ctx.db.insert("teams", {
      name: "Winner FC",
      leagueId,
      divisionId: null,
      city: "W",
      stadium: "W",
      foundedYear: null,
      location: "W",
      logoUrl: null,
      rosterLimit: null,
    });
    const teamLoser = await ctx.db.insert("teams", {
      name: "Loser FC",
      leagueId,
      divisionId: null,
      city: "L",
      stadium: "L",
      foundedYear: null,
      location: "L",
      logoUrl: null,
      rosterLimit: null,
    });
    const activeSeason = await ctx.db.insert("seasons", {
      name: "2026",
      leagueId,
      startDate: "2026-09-01",
      endDate: null,
      status: "active",
      rosterLocked: false,
    });
    const upcomingSeason = await ctx.db.insert("seasons", {
      name: "2027",
      leagueId,
      startDate: "2027-09-01",
      endDate: null,
      status: "upcoming",
      rosterLocked: false,
    });
    const fixtureId = await ctx.db.insert("fixtures", {
      seasonId: activeSeason,
      homeTeamId: teamWinner,
      awayTeamId: teamLoser,
      scheduledAt: null,
      week: 1,
      venue: null,
      status: "final",
      stage: "regular",
      createdAt: new Date().toISOString(),
      createdBy: ACTOR,
    });
    await ctx.db.insert("gameResults", {
      fixtureId,
      homeScore: 28,
      awayScore: 7,
      playerStatsJson: null,
      recordedAt: new Date().toISOString(),
      recordedBy: ACTOR,
    });
    const fa1 = await ctx.db.insert("players", {
      name: "Pool One",
      leagueId,
      teamId: teamLoser,
      position: "WR",
      positionGroup: null,
      jerseyNumber: 80,
      dateOfBirth: null,
      status: "free_agent",
      headshotUrl: null,
      grade: 11,
    });
    const fa2 = await ctx.db.insert("players", {
      name: "Pool Two",
      leagueId,
      teamId: teamLoser,
      position: "RB",
      positionGroup: null,
      jerseyNumber: 81,
      dateOfBirth: null,
      status: "free_agent",
      headshotUrl: null,
      grade: 10,
    });
    const extraFreeAgents: Id<"players">[] = [];
    for (let i = 3; i <= 6; i++) {
      extraFreeAgents.push(
        await ctx.db.insert("players", {
          name: `Pool ${i}`,
          leagueId,
          teamId: teamLoser,
          position: "WR",
          positionGroup: null,
          jerseyNumber: 80 + i,
          dateOfBirth: null,
          status: "free_agent",
          headshotUrl: null,
          grade: 11,
        }),
      );
    }
    return {
      leagueId,
      teamWinner,
      teamLoser,
      activeSeason,
      upcomingSeason,
      fa1,
      fa2,
      extraFreeAgents,
    };
  });
}

describe("startDraft", () => {
  it("orders teams reverse final standings (worst team first)", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedDraftLeague(t);

    const res = await t.mutation(internal.sports.startDraft, {
      leagueId: seed.leagueId,
      seasonId: seed.upcomingSeason,
    });

    expect(res.order).toEqual([
      seed.teamLoser as string,
      seed.teamWinner as string,
    ]);
  });

  it("rejects when a draft already exists for the season", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedDraftLeague(t);

    await t.mutation(internal.sports.startDraft, {
      leagueId: seed.leagueId,
      seasonId: seed.upcomingSeason,
    });

    await expect(
      t.mutation(internal.sports.startDraft, {
        leagueId: seed.leagueId,
        seasonId: seed.upcomingSeason,
      }),
    ).rejects.toThrow("draft_exists");
  });

  it("rejects when the free-agent pool is empty", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedDraftLeague(t);

    await t.run(async (ctx) => {
      const players = await ctx.db
        .query("players")
        .withIndex("by_leagueId", (q) => q.eq("leagueId", seed.leagueId))
        .collect();
      for (const p of players) {
        if (p.status === "free_agent") {
          await ctx.db.patch(p._id, { status: "active" });
        }
      }
    });

    await expect(
      t.mutation(internal.sports.startDraft, {
        leagueId: seed.leagueId,
        seasonId: seed.upcomingSeason,
      }),
    ).rejects.toThrow("empty_pool");
  });
});

describe("makeDraftPick", () => {
  it("rosters the player and advances the snake draft", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedDraftLeague(t);

    const { draftId } = await t.mutation(internal.sports.startDraft, {
      leagueId: seed.leagueId,
      seasonId: seed.upcomingSeason,
    });

    const afterPick1 = await t.mutation(internal.sports.makeDraftPick, {
      draftId: draftId as Id<"drafts">,
      playerId: seed.fa1,
      actorUserId: ACTOR,
    });

    expect(afterPick1.currentPick).toBe(2);
    expect(afterPick1.onClockTeamId).toBe(seed.teamWinner as string);
    expect(afterPick1.picks).toHaveLength(1);
    expect(afterPick1.picks[0]).toMatchObject({
      pickNumber: 1,
      round: 1,
      teamId: seed.teamLoser as string,
      playerId: seed.fa1 as string,
    });

    const player = await t.run((ctx) => ctx.db.get(seed.fa1));
    expect(player?.status).toBe("active");
    expect(player?.teamId).toBe(seed.teamLoser);

    const assignment = await t.run(async (ctx) =>
      ctx.db
        .query("rosterAssignments")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", seed.upcomingSeason).eq("teamId", seed.teamLoser),
        )
        .first(),
    );
    expect(assignment?.playerId).toBe(seed.fa1);
  });

  it("rejects re-picking a filled slot", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedDraftLeague(t);

    const { draftId } = await t.mutation(internal.sports.startDraft, {
      leagueId: seed.leagueId,
      seasonId: seed.upcomingSeason,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("draftPicks", {
        draftId: draftId as Id<"drafts">,
        round: 1,
        pickNumber: 1,
        teamId: seed.teamLoser,
        playerId: seed.fa1,
        madeAt: Date.now(),
      });
    });

    await expect(
      t.mutation(internal.sports.makeDraftPick, {
        draftId: draftId as Id<"drafts">,
        playerId: seed.fa2,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow("pick_already_made");
  });

  it("completes the draft after all picks are made", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedDraftLeague(t);

    const extraFaIds = await t.run(async (ctx) => {
      const ids: Id<"players">[] = [];
      for (let i = 0; i < 4; i++) {
        ids.push(
          await ctx.db.insert("players", {
            name: `Pool Extra ${i}`,
            leagueId: seed.leagueId,
            teamId: seed.teamLoser,
            position: "OL",
            positionGroup: null,
            jerseyNumber: 90 + i,
            dateOfBirth: null,
            status: "free_agent",
            headshotUrl: null,
          }),
        );
      }
      return ids;
    });

    const { draftId, order } = await t.mutation(internal.sports.startDraft, {
      leagueId: seed.leagueId,
      seasonId: seed.upcomingSeason,
    });

    const rounds = 3;
    const picks: string[] = [
      seed.fa1 as string,
      seed.fa2 as string,
      ...extraFaIds.map((id) => id as string),
    ];
    let state = await t.query(api.sports.getDraft, {
      seasonId: seed.upcomingSeason,
    });
    expect(state?.status).toBe("active");

    for (let pickNum = 1; pickNum <= rounds * order.length; pickNum++) {
      const onClock = teamOnClock(order, pickNum, rounds);
      const playerId = picks[pickNum - 1] as Id<"players">;
      state = await t.mutation(internal.sports.makeDraftPick, {
        draftId: draftId as Id<"drafts">,
        playerId,
        actorUserId: ACTOR,
      });
      expect(state.onClockTeamId).toBe(
        pickNum < rounds * order.length
          ? teamOnClock(order, pickNum + 1, rounds)
          : null,
      );
      if (onClock) {
        expect(state.picks[pickNum - 1]?.teamId).toBe(onClock);
      }
    }

    expect(state?.status).toBe("complete");
    expect(state?.currentPick).toBe(rounds * order.length + 1);
  });
});

describe("endDraft", () => {
  it("marks the draft complete while pool players stay free agents", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedDraftLeague(t);

    const { draftId } = await t.mutation(internal.sports.startDraft, {
      leagueId: seed.leagueId,
      seasonId: seed.upcomingSeason,
    });

    const res = await t.mutation(internal.sports.endDraft, {
      draftId: draftId as Id<"drafts">,
    });
    expect(res).toEqual({ draftId, status: "complete" });

    const draft = await t.query(api.sports.getDraft, {
      seasonId: seed.upcomingSeason,
    });
    expect(draft?.status).toBe("complete");

    const fa2 = await t.run((ctx) => ctx.db.get(seed.fa2));
    expect(fa2?.status).toBe("free_agent");
  });
});

describe("getDraft", () => {
  it("returns draft state with on-clock team for an active draft", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedDraftLeague(t);

    await t.mutation(internal.sports.startDraft, {
      leagueId: seed.leagueId,
      seasonId: seed.upcomingSeason,
    });

    const draft = await t.query(api.sports.getDraft, {
      seasonId: seed.upcomingSeason,
    });
    expect(draft).toMatchObject({
      seasonId: seed.upcomingSeason as string,
      type: "snake",
      rounds: 3,
      status: "active",
      currentPick: 1,
      onClockTeamId: seed.teamLoser as string,
      picks: [],
    });
  });
});
