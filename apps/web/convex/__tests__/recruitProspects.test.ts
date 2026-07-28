/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import { MAX_SCOUT_LEVEL, SCOUT_LEVEL_COST } from "../lib/scouting";

const modules = import.meta.glob("../**/*.*s");

const ACTOR = "user_admin";

const ATTRIBUTES = { SPD: 80, STR: 70, AWR: 66, ACC: 74, AGI: 58 };

function prospectInput(overrides: Partial<{ name: string; trueOverall: number }> = {}) {
  return {
    name: overrides.name ?? "Cam Whitfield",
    position: "WR",
    positionGroup: "WR",
    archetype: "Deep Threat",
    hometown: "Acworth, GA",
    trueAttributesJson: JSON.stringify(ATTRIBUTES),
    trueOverall: overrides.trueOverall ?? 70,
    potentialTier: "riser",
  };
}

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const leagueId = await ctx.db.insert("leagues", {
      name: "Recruiting League",
      orgId: "org_test",
      isPublic: false,
      inviteToken: null,
    });
    const seasonId = await ctx.db.insert("seasons", {
      leagueId,
      name: "2027",
      status: "upcoming",
      startDate: null,
      endDate: null,
      rosterLocked: false,
    });
    const teamId = await ctx.db.insert("teams", {
      leagueId,
      name: "North HS",
      city: "North",
      stadium: "North Field",
      location: "North, GA",
      foundedYear: null,
      divisionId: null,
      rosterLimit: null,
      logoUrl: null,
    });
    const otherTeamId = await ctx.db.insert("teams", {
      leagueId,
      name: "South HS",
      city: "South",
      stadium: "South Field",
      location: "South, GA",
      foundedYear: null,
      divisionId: null,
      rosterLimit: null,
      logoUrl: null,
    });
    return { leagueId, seasonId, teamId, otherTeamId };
  });
}

async function classOf(
  t: ReturnType<typeof convexTest>,
  ids: { leagueId: never; seasonId: never },
  count = 1,
) {
  await t.mutation(internal.dynasty.createProspectClass, {
    leagueId: ids.leagueId,
    seasonId: ids.seasonId,
    prospects: Array.from({ length: count }, (_, i) =>
      prospectInput({ name: `Prospect ${i}`, trueOverall: 60 + i }),
    ),
  });
  return t.query(api.dynasty.listProspects, { seasonId: ids.seasonId });
}

describe("listProspects hides the truth", () => {
  it("never returns the hidden fields", async () => {
    /*
     * The mechanic in one assertion. If `trueOverall` or `potentialTier` ever
     * reaches a page, a coach can rank the whole board exactly and scouting
     * becomes a button nobody presses.
     */
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const board = await classOf(t, ids as never, 3);
    expect(board).toHaveLength(3);
    for (const prospect of board) {
      expect(prospect).not.toHaveProperty("trueAttributesJson");
      expect(prospect).not.toHaveProperty("trueOverall");
      expect(prospect).not.toHaveProperty("potentialTier");
    }
  });

  it("keeps the hidden fields out of the source validator too", () => {
    /*
     * The runtime assertion above only sees the fields a fixture happens to
     * exercise. This one reads the module and fails if any of the three names
     * is ever added to `prospectValidator` — the change that would silently
     * make the runtime test pass while leaking everything.
     */
    const source = readFileSync(
      join(__dirname, "..", "dynasty.ts"),
      "utf8",
    );
    const validator = /const prospectValidator = v\.object\(\{([\s\S]*?)\n\}\);/
      .exec(source)?.[1];
    expect(validator).toBeDefined();
    for (const hidden of [
      "trueAttributesJson",
      "trueOverall",
      "potentialTier",
    ]) {
      expect(validator).not.toContain(hidden);
    }
  });

  it("shows a projected range instead, at level 0", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [prospect] = await classOf(t, ids as never);
    expect(prospect.scoutLevel).toBe(0);
    expect(prospect.projectedHigh).toBeGreaterThan(prospect.projectedLow);
    expect(prospect.projectedLow).toBeLessThanOrEqual(60);
    expect(prospect.projectedHigh).toBeGreaterThanOrEqual(60);
  });
});

describe("createProspectClass", () => {
  it("does not build a second class on a retry", async () => {
    // The rollover stage can be retried after a lost response. Two classes on
    // one board would look like a very good recruiting year.
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await classOf(t, ids as never, 4);
    const retry = await t.mutation(internal.dynasty.createProspectClass, {
      leagueId: ids.leagueId,
      seasonId: ids.seasonId,
      prospects: [prospectInput({ name: "Late Addition" })],
    });
    expect(retry).toEqual({ created: 4, alreadyExisted: true });
    const board = await t.query(api.dynasty.listProspects, {
      seasonId: ids.seasonId,
    });
    expect(board).toHaveLength(4);
    expect(board.map((p) => p.name)).not.toContain("Late Addition");
  });

  it("refuses a class whose season belongs to another league", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const otherLeagueId = await t.run(async (ctx) =>
      ctx.db.insert("leagues", {
        name: "Other",
        orgId: "org_test",
        isPublic: false,
        inviteToken: null,
      }),
    );
    await expect(
      t.mutation(internal.dynasty.createProspectClass, {
        leagueId: otherLeagueId,
        seasonId: ids.seasonId,
        prospects: [prospectInput()],
      }),
    ).rejects.toThrow(/season_league_mismatch/);
  });
});

describe("scoutProspect", () => {
  it("narrows the range and charges the league budget", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [before] = await classOf(t, ids as never);
    const result = await t.mutation(internal.dynasty.scoutProspect, {
      prospectId: before.id as never,
      teamId: ids.teamId,
      actorUserId: ACTOR,
    });
    expect(result.prospect.scoutLevel).toBe(1);
    expect(
      result.prospect.projectedHigh - result.prospect.projectedLow,
    ).toBeLessThan(before.projectedHigh - before.projectedLow);
    expect(result.scoutingPointsSpent).toBe(SCOUT_LEVEL_COST[1]);
  });

  it("opens the offseason on demand rather than requiring an admin first", async () => {
    /*
     * The budget lives on the offseason row. A coach spending points is not
     * necessarily the person who opens the offseason, so making the budget's
     * existence depend on someone else's page load would be a race.
     */
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    expect(
      await t.query(api.dynasty.getOffseason, { seasonId: ids.seasonId }),
    ).toBeNull();
    const [prospect] = await classOf(t, ids as never);
    await t.mutation(internal.dynasty.scoutProspect, {
      prospectId: prospect.id as never,
      teamId: ids.teamId,
      actorUserId: ACTOR,
    });
    const offseason = await t.query(api.dynasty.getOffseason, {
      seasonId: ids.seasonId,
    });
    expect(offseason?.scoutingPointsSpent).toBe(SCOUT_LEVEL_COST[1]);
  });

  it("stops at the top level instead of charging for nothing", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [prospect] = await classOf(t, ids as never);
    for (let level = 0; level < MAX_SCOUT_LEVEL; level++) {
      await t.mutation(internal.dynasty.scoutProspect, {
        prospectId: prospect.id as never,
        teamId: ids.teamId,
        actorUserId: ACTOR,
      });
    }
    await expect(
      t.mutation(internal.dynasty.scoutProspect, {
        prospectId: prospect.id as never,
        teamId: ids.teamId,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/prospect_fully_scouted/);
  });

  it("refuses to overspend the budget", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    await t.mutation(internal.dynasty.setDynastyConfig, {
      leagueId: ids.leagueId,
      actorUserId: ACTOR,
      patch: { scoutingPointsPerOffseason: SCOUT_LEVEL_COST[1] },
    });
    const board = await classOf(t, ids as never, 2);
    await t.mutation(internal.dynasty.scoutProspect, {
      prospectId: board[0].id as never,
      teamId: ids.teamId,
      actorUserId: ACTOR,
    });
    await expect(
      t.mutation(internal.dynasty.scoutProspect, {
        prospectId: board[1].id as never,
        teamId: ids.teamId,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/scouting_budget_exhausted/);
  });

  it("refuses a team from another league", async () => {
    // The per-team argument is the Wave 5 hook; this is the check that makes
    // it mean something today.
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [prospect] = await classOf(t, ids as never);
    const foreignTeamId = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        name: "Other",
        orgId: "org_test",
        isPublic: false,
        inviteToken: null,
      });
      return ctx.db.insert("teams", {
        leagueId,
        name: "Elsewhere HS",
        city: "Elsewhere",
        stadium: "Elsewhere Field",
        location: "Elsewhere, GA",
        foundedYear: null,
        divisionId: null,
        rosterLimit: null,
        logoUrl: null,
      });
    });
    await expect(
      t.mutation(internal.dynasty.scoutProspect, {
        prospectId: prospect.id as never,
        teamId: foreignTeamId,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/team_league_mismatch/);
  });
});

describe("signProspect", () => {
  it("creates one grade-9 player with a roster spot and the TRUE ratings", async () => {
    /*
     * The moment of truth. The attribute snapshot has to be the real map, not
     * the scouted one — otherwise the uncertainty becomes permanent and every
     * downstream system reasons about a guess.
     */
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [prospect] = await classOf(t, ids as never);
    const result = await t.mutation(internal.dynasty.signProspect, {
      prospectId: prospect.id as never,
      teamId: ids.teamId,
      actorUserId: ACTOR,
    });
    expect(result.alreadySigned).toBe(false);

    await t.run(async (ctx) => {
      const player = await ctx.db.get(result.playerId as never);
      expect(player).toMatchObject({
        name: prospect.name,
        teamId: ids.teamId,
        grade: 9,
        status: "active",
      });

      const assignments = await ctx.db
        .query("rosterAssignments")
        .withIndex("by_playerId", (q) =>
          q.eq("playerId", result.playerId as never),
        )
        .collect();
      expect(assignments).toHaveLength(1);
      expect(assignments[0]).toMatchObject({
        seasonId: ids.seasonId,
        teamId: ids.teamId,
        status: "active",
      });

      const attributes = await ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", result.playerId as never),
        )
        .collect();
      expect(attributes).toHaveLength(1);
      expect(JSON.parse(attributes[0].attributesJson)).toEqual(ATTRIBUTES);
      expect(attributes[0].weightedOverall).toBe(60);
    });
  });

  it("records who signed him on the class, not only on the player", async () => {
    // A signed player can be released or traded later; the class should keep
    // saying who actually recruited him.
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [prospect] = await classOf(t, ids as never);
    const result = await t.mutation(internal.dynasty.signProspect, {
      prospectId: prospect.id as never,
      teamId: ids.teamId,
      actorUserId: ACTOR,
    });
    expect(result.prospect.signedTeamId).toBe(ids.teamId);
    expect(result.prospect.playerId).toBe(result.playerId);
  });

  it("is a no-op on re-invoke by the same team", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [prospect] = await classOf(t, ids as never);
    const first = await t.mutation(internal.dynasty.signProspect, {
      prospectId: prospect.id as never,
      teamId: ids.teamId,
      actorUserId: ACTOR,
    });
    const second = await t.mutation(internal.dynasty.signProspect, {
      prospectId: prospect.id as never,
      teamId: ids.teamId,
      actorUserId: ACTOR,
    });
    expect(second.alreadySigned).toBe(true);
    expect(second.playerId).toBe(first.playerId);

    await t.run(async (ctx) => {
      const players = await ctx.db
        .query("players")
        .withIndex("by_teamId", (q) => q.eq("teamId", ids.teamId))
        .collect();
      expect(players).toHaveLength(1);
    });
  });

  it("tells a losing team it lost rather than handing it the player", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [prospect] = await classOf(t, ids as never);
    await t.mutation(internal.dynasty.signProspect, {
      prospectId: prospect.id as never,
      teamId: ids.teamId,
      actorUserId: ACTOR,
    });
    await expect(
      t.mutation(internal.dynasty.signProspect, {
        prospectId: prospect.id as never,
        teamId: ids.otherTeamId,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/prospect_already_signed/);
  });

  it("caps a team's class so one program cannot take the board", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const board = await classOf(t, ids as never, 12);
    for (let i = 0; i < 6; i++) {
      await t.mutation(internal.dynasty.signProspect, {
        prospectId: board[i].id as never,
        teamId: ids.teamId,
        actorUserId: ACTOR,
      });
    }
    await expect(
      t.mutation(internal.dynasty.signProspect, {
        prospectId: board[6].id as never,
        teamId: ids.teamId,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/recruiting_class_full/);

    // Another program is unaffected — the cap is per team, not per class.
    const other = await t.mutation(internal.dynasty.signProspect, {
      prospectId: board[6].id as never,
      teamId: ids.otherTeamId,
      actorUserId: ACTOR,
    });
    expect(other.alreadySigned).toBe(false);
  });

  it("refuses to sign into a locked roster", async () => {
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [prospect] = await classOf(t, ids as never);
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.seasonId, { rosterLocked: true } as never);
    });
    await expect(
      t.mutation(internal.dynasty.signProspect, {
        prospectId: prospect.id as never,
        teamId: ids.teamId,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/season_locked/);
  });

  it("cannot be scouted after signing", async () => {
    // Scouting resolves into a signing. Paying to narrow a range on a player
    // whose real ratings are already on the roster would be selling nothing.
    const t = convexTest(schema, modules);
    const ids = await seed(t);
    const [prospect] = await classOf(t, ids as never);
    await t.mutation(internal.dynasty.signProspect, {
      prospectId: prospect.id as never,
      teamId: ids.teamId,
      actorUserId: ACTOR,
    });
    await expect(
      t.mutation(internal.dynasty.scoutProspect, {
        prospectId: prospect.id as never,
        teamId: ids.teamId,
        actorUserId: ACTOR,
      }),
    ).rejects.toThrow(/prospect_already_signed/);
  });
});
