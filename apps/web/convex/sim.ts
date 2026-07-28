import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";
import {
  normalizeIntensity,
  rivalryPairKey,
  sortRivalryTeams,
} from "./lib/rivalries";
import type { Id } from "./_generated/dataModel";

/*
 * Dynasty Mode — simulation persistence (Epic A).
 *
 * Home for injury rows, rivalry config and the season-aggregate maintenance
 * hooks the sim path writes through. Empty in F1 beyond the readiness probe.
 *
 * ## Boundary
 *
 * The play-by-play ENGINE stays a pure library in `src/lib/pbp/` and this
 * module never calls it. Sim orchestration stays in the existing Next server
 * actions (`simulateAndPersistFixture` remains the single choke point). This
 * module only persists what a simulated game produced. Keeping the engine free
 * of Convex is what lets the golden-log parity and 200-game distribution tests
 * run as plain unit tests with no database.
 *
 * ## Rules
 *
 * 1. Every WRITE is an `internalMutation` (WSM-000096); the guard test's
 *    `AllowedPublicSimReads` backstop fails `tsc` if one leaks.
 * 2. Every function declares a `returns:` validator (WSM-000166).
 * 3. Stored `gamePlayLogs` rows are IMMUTABLE. Never rewrite a log to migrate
 *    it — readers call `normalizeGameLog` and up-convert in memory.
 */

/** Module readiness probe — see `lib/moduleStatus.ts` for why this exists. */
export const moduleStatus = query({
  args: {},
  returns: moduleStatusValidator,
  handler: async () => ({
    module: DYNASTY_MODULES.sim,
    epic: "A",
    ready: true,
  }),
});

/*
 * ── Rivalries (A5) ──────────────────────────────────────────────────────────
 */

const rivalryValidator = v.object({
  id: v.id("rivalries"),
  leagueId: v.id("leagues"),
  teamAId: v.id("teams"),
  teamBId: v.id("teams"),
  pairKey: v.string(),
  name: v.union(v.string(), v.null()),
  intensity: v.number(),
  createdAt: v.string(),
});

/**
 * Every declared rivalry in a league.
 *
 * A league has a handful at most, so this reads the whole indexed set rather
 * than paginating — the caller wants them all to decorate a schedule.
 */
export const listRivalries = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(rivalryValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("rivalries")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    return rows.map((row) => ({
      id: row._id,
      leagueId: row.leagueId,
      teamAId: row.teamAId,
      teamBId: row.teamBId,
      pairKey: row.pairKey,
      name: row.name ?? null,
      intensity: row.intensity,
      createdAt: row.createdAt,
    }));
  },
});

/**
 * Declare a rivalry, or update the one that already exists for this pairing.
 *
 * Upsert rather than insert, keyed on the sorted pair: re-declaring "A vs B"
 * after declaring "B vs A" must adjust the existing rivalry, not create a
 * second row that disagrees with it about how big the game is.
 *
 * `internalMutation` (WSM-000096) — the admin gate lives in the server action.
 */
export const upsertRivalry = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    actorUserId: v.string(),
    teamAId: v.id("teams"),
    teamBId: v.id("teams"),
    name: v.optional(v.string()),
    intensity: v.optional(v.number()),
  },
  returns: rivalryValidator,
  handler: async (ctx, args) => {
    if (args.teamAId === args.teamBId) throw new Error("same_team");

    const league = await ctx.db.get(args.leagueId);
    if (!league) throw new Error("league_not_found");

    const [teamA, teamB] = await Promise.all([
      ctx.db.get(args.teamAId),
      ctx.db.get(args.teamBId),
    ]);
    if (!teamA || !teamB) throw new Error("team_not_found");
    // A rivalry spans two teams in ONE league; a cross-league row would be
    // unreachable from either league's schedule.
    if (teamA.leagueId !== args.leagueId || teamB.leagueId !== args.leagueId) {
      throw new Error("team_not_in_league");
    }

    const [sortedA, sortedB] = sortRivalryTeams(args.teamAId, args.teamBId);
    const pairKey = rivalryPairKey(args.teamAId, args.teamBId);
    const intensity = normalizeIntensity(args.intensity ?? 60);

    const existing = await ctx.db
      .query("rivalries")
      .withIndex("by_leagueId_pairKey", (q) =>
        q.eq("leagueId", args.leagueId).eq("pairKey", pairKey),
      )
      .first();

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        intensity,
        ...(args.name === undefined ? {} : { name: args.name }),
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) throw new Error("rivalry_not_found");
      return {
        id: updated._id,
        leagueId: updated.leagueId,
        teamAId: updated.teamAId,
        teamBId: updated.teamBId,
        pairKey: updated.pairKey,
        name: updated.name ?? null,
        intensity: updated.intensity,
        createdAt: updated.createdAt,
      };
    }

    const id = await ctx.db.insert("rivalries", {
      leagueId: args.leagueId,
      teamAId: sortedA as Id<"teams">,
      teamBId: sortedB as Id<"teams">,
      pairKey,
      ...(args.name === undefined ? {} : { name: args.name }),
      intensity,
      createdAt: now,
      createdBy: args.actorUserId,
    });

    return {
      id,
      leagueId: args.leagueId,
      teamAId: sortedA as Id<"teams">,
      teamBId: sortedB as Id<"teams">,
      pairKey,
      name: args.name ?? null,
      intensity,
      createdAt: now,
    };
  },
});

/** Remove a rivalry. Idempotent: deleting one that is already gone succeeds. */
export const deleteRivalry = internalMutation({
  args: { rivalryId: v.id("rivalries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.rivalryId);
    if (existing) await ctx.db.delete(args.rivalryId);
    return null;
  },
});
