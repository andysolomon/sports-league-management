/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";

const modules = import.meta.glob("../**/*.*s");

const ACTOR = "user_admin";

/*
 * Offseason training (B6). Two teams so the per-team budget has something to be
 * wrong about, and one player with no ratings so the apply step has a case
 * where there is genuinely nothing to train.
 */
async function seedLeague(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Training League",
      orgId: "org_test",
      isPublic: false,
      inviteToken: null,
    });
    const seasonId = await ctx.db.insert("seasons", {
      leagueId,
      name: "2028",
      status: "upcoming",
      startDate: null,
      endDate: null,
      rosterLocked: false,
    });

    const teamIds: string[] = [];
    for (const name of ["North", "South"]) {
      teamIds.push(
        (await ctx.db.insert("teams", {
          leagueId,
          name: `${name} HS`,
          city: name,
          stadium: `${name} Field`,
          location: `${name}, GA`,
          foundedYear: null,
          divisionId: null,
          rosterLimit: null,
          logoUrl: null,
        })) as string,
      );
    }

    async function addPlayer(spec: {
      name: string;
      position: string;
      teamIndex?: number;
      attributes?: Record<string, number> | null;
    }) {
      const teamId = teamIds[spec.teamIndex ?? 0] as never;
      const playerId = await ctx.db.insert("players", {
        name: spec.name,
        leagueId,
        teamId,
        position: spec.position,
        positionGroup: null,
        jerseyNumber: null,
        dateOfBirth: null,
        status: "active",
        headshotUrl: null,
        experienceYears: null,
        grade: 10,
        squad: "JV",
        hometown: null,
        synthetic: true,
      });
      if (spec.attributes) {
        const values = Object.values(spec.attributes);
        await ctx.db.insert("playerAttributes", {
          playerId,
          seasonId,
          positionGroup: "WR",
          attributesJson: JSON.stringify(spec.attributes),
          pffSourceJson: null,
          maddenSourceJson: null,
          pffWeight: 0,
          maddenWeight: 0,
          weightedOverall: Math.round(
            values.reduce((a, b) => a + b, 0) / values.length,
          ),
          ingestedAt: new Date(0).toISOString(),
        });
      }
      return playerId;
    }

    const receiver = await addPlayer({
      name: "Cam Whitfield",
      position: "WR",
      attributes: { SPD: 70, ACC: 68, AGI: 72, STR: 60, AWR: 66, CTH: 74 },
    });
    const unrated = await addPlayer({
      name: "Walk On",
      position: "WR",
      attributes: null,
    });
    const rival = await addPlayer({
      name: "Other Program",
      position: "WR",
      teamIndex: 1,
      attributes: { SPD: 70, ACC: 68, AGI: 72, STR: 60, AWR: 66, CTH: 74 },
    });

    return { leagueId, seasonId, teamIds, receiver, unrated, rival };
  });
}

describe("allocateTraining", () => {
  it("records an allocation and reports the spend back", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);

    const result = await t.mutation(internal.dynasty.allocateTraining, {
      playerId: seed.receiver,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      focus: "athleticism",
      points: 5,
      actorUserId: ACTOR,
    });

    expect(result.pointsSpent).toBe(5);
    expect(result.allocation.appliedAt).toBeNull();

    const ledger = await t.query(api.dynasty.listTrainingAllocations, {
      seasonId: seed.seasonId,
      teamId: seed.teamIds[0] as never,
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.focus).toBe("athleticism");
  });

  it("does not change the player's ratings yet — an allocation is a plan", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);

    await t.mutation(internal.dynasty.allocateTraining, {
      playerId: seed.receiver,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      focus: "athleticism",
      points: 5,
      actorUserId: ACTOR,
    });

    const before = await t.run(async (ctx) =>
      ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", seed.receiver).eq("seasonId", seed.seasonId),
        )
        .first(),
    );
    expect(JSON.parse(before!.attributesJson).SPD).toBe(70);
  });

  it("refuses to spend past the team's allowance", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("offseasons")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", seed.seasonId))
        .first();
      if (row) await ctx.db.patch(row._id, { trainingPointsTotal: 6 });
      else {
        await ctx.db.insert("offseasons", {
          leagueId: seed.leagueId,
          seasonId: seed.seasonId,
          phase: "training",
          completedPhases: ["rollover"],
          scoutingPointsTotal: 100,
          scoutingPointsSpent: 0,
          trainingPointsTotal: 6,
          trainingPointsSpent: 0,
          configJson: "{}",
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          updatedBy: ACTOR,
        });
      }
    });

    const spend = (points: number) =>
      t.mutation(internal.dynasty.allocateTraining, {
        playerId: seed.receiver,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        focus: "athleticism",
        points,
        actorUserId: ACTOR,
      });

    await spend(5);
    await expect(spend(5)).rejects.toThrow(/training_budget_exhausted/);
    // The one that exactly fills the budget is still allowed.
    await expect(spend(1)).resolves.toBeTruthy();
  });

  it("keeps each team's budget its own", async () => {
    /*
     * The divergence from B3's shared scouting pool. A shared training budget
     * means the first coach to open the hub spends the league's spring on his
     * own quarterback.
     */
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);

    await t.mutation(internal.dynasty.allocateTraining, {
      playerId: seed.receiver,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      focus: "athleticism",
      points: 10,
      actorUserId: ACTOR,
    });
    const rival = await t.mutation(internal.dynasty.allocateTraining, {
      playerId: seed.rival,
      teamId: seed.teamIds[1] as never,
      seasonId: seed.seasonId,
      focus: "athleticism",
      points: 10,
      actorUserId: ACTOR,
    });

    expect(rival.pointsSpent).toBe(10);
  });

  it("refuses to train a player who is not on the team", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);

    await expect(
      t.mutation(internal.dynasty.allocateTraining, {
        playerId: seed.rival,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        focus: "athleticism",
        points: 5,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/player_not_on_team/);
  });

  it("refuses a focus that is not one", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);

    await expect(
      t.mutation(internal.dynasty.allocateTraining, {
        playerId: seed.receiver,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        focus: "vibes",
        points: 5,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/invalid_focus/);
  });

  it("refuses to train against a locked roster", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    await t.run(async (ctx) =>
      ctx.db.patch(seed.seasonId, { rosterLocked: true }),
    );

    await expect(
      t.mutation(internal.dynasty.allocateTraining, {
        playerId: seed.receiver,
        teamId: seed.teamIds[0] as never,
        seasonId: seed.seasonId,
        focus: "athleticism",
        points: 5,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/season_locked/);
  });

  it("shows a team only its own ledger", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);

    await t.mutation(internal.dynasty.allocateTraining, {
      playerId: seed.rival,
      teamId: seed.teamIds[1] as never,
      seasonId: seed.seasonId,
      focus: "technique",
      points: 5,
      actorUserId: ACTOR,
    });

    const mine = await t.query(api.dynasty.listTrainingAllocations, {
      seasonId: seed.seasonId,
      teamId: seed.teamIds[0] as never,
    });
    expect(mine).toEqual([]);
  });
});

describe("applyTrainingAllocations", () => {
  async function allocate(
    t: ReturnType<typeof convexTest>,
    seed: Awaited<ReturnType<typeof seedLeague>>,
    playerId: (typeof seed)["receiver"],
    points = 5,
  ) {
    return t.mutation(internal.dynasty.allocateTraining, {
      playerId,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      focus: "athleticism",
      points,
      actorUserId: ACTOR,
    });
  }

  it("lands the gain on the player's ratings", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    await allocate(t, seed, seed.receiver);

    const result = await t.mutation(
      internal.dynasty.applyTrainingAllocations,
      { seasonId: seed.seasonId, actorUserId: ACTOR },
    );
    expect(result.playersTrained).toBe(1);
    expect(result.pointsPlaced).toBeGreaterThan(0);

    const after = await t.run(async (ctx) =>
      ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", seed.receiver).eq("seasonId", seed.seasonId),
        )
        .first(),
    );
    const attributes = JSON.parse(after!.attributesJson);
    expect(attributes.SPD + attributes.ACC + attributes.AGI).toBeGreaterThan(
      70 + 68 + 72,
    );
    // Untouched by an athleticism focus.
    expect(attributes.CTH).toBe(74);
  });

  it("applies twice with one effect — the appliedAt guard", async () => {
    /*
     * The single most damaging way this could go wrong. Application is additive
     * (a freshman signed in this offseason has no prior season to re-derive
     * from), so without the stamp a retried advance trains the whole roster
     * again.
     */
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    await allocate(t, seed, seed.receiver);

    const first = await t.mutation(
      internal.dynasty.applyTrainingAllocations,
      { seasonId: seed.seasonId, actorUserId: ACTOR },
    );
    const snapshot = await t.run(async (ctx) =>
      ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", seed.receiver).eq("seasonId", seed.seasonId),
        )
        .first(),
    );

    const second = await t.mutation(
      internal.dynasty.applyTrainingAllocations,
      { seasonId: seed.seasonId, actorUserId: ACTOR },
    );
    expect(second).toEqual({ applied: 0, playersTrained: 0, pointsPlaced: 0 });

    const again = await t.run(async (ctx) =>
      ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", seed.receiver).eq("seasonId", seed.seasonId),
        )
        .first(),
    );
    expect(again!.attributesJson).toBe(snapshot!.attributesJson);
    expect(first.applied).toBe(1);
  });

  it("records what the points bought", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    await allocate(t, seed, seed.receiver);
    await t.mutation(internal.dynasty.applyTrainingAllocations, {
      seasonId: seed.seasonId,
      actorUserId: ACTOR,
    });

    const ledger = await t.query(api.dynasty.listTrainingAllocations, {
      seasonId: seed.seasonId,
      teamId: seed.teamIds[0] as never,
    });
    expect(ledger[0]?.appliedAt).not.toBeNull();
    const gains = JSON.parse(ledger[0]!.appliedGainJson!);
    expect(Object.keys(gains).length).toBeGreaterThan(0);
  });

  it("shifts the overall by what training added rather than redefining it", async () => {
    /*
     * `weightedOverall` is a PFF/Madden blend for a player with real ratings,
     * not a mean. Replacing it with a fresh average would move the number for a
     * reason unrelated to the points a coach spent.
     */
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", seed.receiver).eq("seasonId", seed.seasonId),
        )
        .first();
      // Deliberately nothing like the mean of the map.
      if (row) await ctx.db.patch(row._id, { weightedOverall: 91 });
    });

    await allocate(t, seed, seed.receiver, 10);
    await t.mutation(internal.dynasty.applyTrainingAllocations, {
      seasonId: seed.seasonId,
      actorUserId: ACTOR,
    });

    const after = await t.run(async (ctx) =>
      ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", seed.receiver).eq("seasonId", seed.seasonId),
        )
        .first(),
    );
    // Six attributes, six points placed → the mean rises by one.
    expect(after!.weightedOverall).toBe(92);
  });

  it("recomputes the overall so the roster and the ratings agree", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    const before = await t.run(async (ctx) =>
      ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", seed.receiver).eq("seasonId", seed.seasonId),
        )
        .first(),
    );
    await allocate(t, seed, seed.receiver, 10);
    await t.mutation(internal.dynasty.applyTrainingAllocations, {
      seasonId: seed.seasonId,
      actorUserId: ACTOR,
    });
    const after = await t.run(async (ctx) =>
      ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", seed.receiver).eq("seasonId", seed.seasonId),
        )
        .first(),
    );
    expect(after!.weightedOverall!).toBeGreaterThan(before!.weightedOverall!);
  });

  it("stamps an unrated player's allocation instead of leaving it pending", async () => {
    // Nothing to train, and a row that never applies would try again on every
    // future advance forever.
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    await allocate(t, seed, seed.unrated);

    const result = await t.mutation(
      internal.dynasty.applyTrainingAllocations,
      { seasonId: seed.seasonId, actorUserId: ACTOR },
    );
    expect(result.applied).toBe(1);
    expect(result.playersTrained).toBe(0);

    const ledger = await t.query(api.dynasty.listTrainingAllocations, {
      seasonId: seed.seasonId,
      teamId: seed.teamIds[0] as never,
    });
    expect(ledger[0]?.appliedAt).not.toBeNull();
  });

  it("is a no-op for a season nobody trained in", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    expect(
      await t.mutation(internal.dynasty.applyTrainingAllocations, {
        seasonId: seed.seasonId,
        actorUserId: ACTOR,
      }),
    ).toEqual({ applied: 0, playersTrained: 0, pointsPlaced: 0 });
  });

  it("gives a player with two allocations one consistent snapshot", async () => {
    const t = convexTest(schema, modules);
    const seed = await seedLeague(t);
    await allocate(t, seed, seed.receiver, 5);
    await t.mutation(internal.dynasty.allocateTraining, {
      playerId: seed.receiver,
      teamId: seed.teamIds[0] as never,
      seasonId: seed.seasonId,
      focus: "technique",
      points: 5,
      actorUserId: ACTOR,
    });

    const result = await t.mutation(
      internal.dynasty.applyTrainingAllocations,
      { seasonId: seed.seasonId, actorUserId: ACTOR },
    );
    expect(result.applied).toBe(2);
    expect(result.playersTrained).toBe(1);
  });
});
