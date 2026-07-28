import { v, type Infer } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";
import { emitDynastyEvent } from "./lib/events";
import {
  normalizeIntensity,
  rivalryPairKey,
  sortRivalryTeams,
} from "./lib/rivalries";
import type { Doc, Id } from "./_generated/dataModel";

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

/*
 * ── Player injuries (A4) ────────────────────────────────────────────────────
 */

const injuryValidator = v.object({
  id: v.string(),
  leagueId: v.string(),
  seasonId: v.string(),
  teamId: v.string(),
  playerId: v.string(),
  fixtureId: v.string(),
  severity: v.string(),
  label: v.string(),
  gamesOut: v.number(),
  initialGamesOut: v.number(),
  weekOccurred: v.union(v.number(), v.null()),
  returnsAfterWeek: v.union(v.number(), v.null()),
  status: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

function toInjuryDto(
  row: Doc<"playerInjuries">,
): Infer<typeof injuryValidator> {
  return {
    id: row._id as string,
    leagueId: row.leagueId as string,
    seasonId: row.seasonId as string,
    teamId: row.teamId as string,
    playerId: row.playerId as string,
    fixtureId: row.fixtureId as string,
    severity: row.severity,
    label: row.label,
    gamesOut: row.gamesOut,
    initialGamesOut: row.initialGamesOut,
    weekOccurred: row.weekOccurred,
    returnsAfterWeek: row.returnsAfterWeek,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Every injury still costing a player games, for one season. */
export const listActiveInjuries = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(injuryValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("playerInjuries")
      .withIndex("by_seasonId_status", (q) =>
        q.eq("seasonId", args.seasonId).eq("status", "out"),
      )
      .collect();
    return rows.map(toInjuryDto);
  },
});

/** Injuries for one team's season, healed ones included, newest first. */
export const listTeamInjuries = query({
  args: { teamId: v.id("teams"), seasonId: v.id("seasons") },
  returns: v.array(injuryValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("playerInjuries")
      .withIndex("by_teamId_seasonId", (q) =>
        q.eq("teamId", args.teamId).eq("seasonId", args.seasonId),
      )
      .collect();
    return rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toInjuryDto);
  },
});

/**
 * Record a game's injuries and tick everyone else's countdown.
 *
 * Both halves belong in ONE mutation because they are one event: a game was
 * played. Splitting them would let a crash between the two leave a season where
 * an injury was recorded but nobody healed, and re-running would then
 * double-decrement.
 *
 * Idempotent on `fixtureId`: re-simulating a game replaces its injuries rather
 * than adding a second set, and does not tick the countdown twice.
 */
export const recordGameInjuries = internalMutation({
  args: {
    fixtureId: v.id("fixtures"),
    seasonId: v.id("seasons"),
    leagueId: v.id("leagues"),
    week: v.union(v.number(), v.null()),
    homeTeamId: v.id("teams"),
    awayTeamId: v.id("teams"),
    injuries: v.array(
      v.object({
        playerId: v.id("players"),
        teamId: v.id("teams"),
        severity: v.string(),
        label: v.string(),
        gamesOut: v.number(),
      }),
    ),
  },
  returns: v.object({ recorded: v.number(), healed: v.number() }),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    const already = await ctx.db
      .query("playerInjuries")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .collect();
    const isResim = already.length > 0;
    for (const row of already) await ctx.db.delete(row._id);

    /*
     * Only the two teams that just played tick down. A league-wide decrement
     * would heal players on teams with a bye, which is precisely the case the
     * games-not-weeks rule exists to get right.
     */
    let healed = 0;
    if (!isResim) {
      for (const teamId of [args.homeTeamId, args.awayTeamId]) {
        const open = await ctx.db
          .query("playerInjuries")
          .withIndex("by_teamId_seasonId", (q) =>
            q.eq("teamId", teamId).eq("seasonId", args.seasonId),
          )
          .collect();
        for (const row of open) {
          if (row.status !== "out" || row.gamesOut <= 0) continue;
          const remaining = row.gamesOut - 1;
          await ctx.db.patch(row._id, {
            gamesOut: remaining,
            status: remaining <= 0 ? "healed" : "out",
            updatedAt: now,
          });
          if (remaining <= 0) healed += 1;
        }
      }
    }

    for (const injury of args.injuries) {
      /*
       * One event per injury, deduped on the fixture and player rather than on
       * anything version-derived. Re-simulating a game must not republish the
       * news — `emitDynastyEvent` no-ops on a key it has already seen.
       */
      const [player, team] = await Promise.all([
        ctx.db.get(injury.playerId),
        ctx.db.get(injury.teamId),
      ]);
      await emitDynastyEvent(ctx, {
        leagueId: args.leagueId,
        seasonId: args.seasonId,
        week: args.week,
        teamId: injury.teamId,
        playerId: injury.playerId,
        fixtureId: args.fixtureId,
        dedupeKey: `injury:${args.fixtureId}:${injury.playerId}`,
        narrative: {
          type: "player_injured",
          playerName: player?.name ?? "A player",
          teamName: team?.name ?? "A team",
          label: injury.label,
          gamesOut: injury.gamesOut,
          week: args.week,
        },
        severity: injury.gamesOut >= 3 ? "notable" : "info",
      });

      await ctx.db.insert("playerInjuries", {
        leagueId: args.leagueId,
        seasonId: args.seasonId,
        teamId: injury.teamId,
        playerId: injury.playerId,
        fixtureId: args.fixtureId,
        severity: injury.severity,
        label: injury.label,
        gamesOut: injury.gamesOut,
        initialGamesOut: injury.gamesOut,
        weekOccurred: args.week,
        returnsAfterWeek:
          args.week === null ? null : args.week + Math.max(0, injury.gamesOut),
        status: injury.gamesOut > 0 ? "out" : "healed",
        createdAt: now,
        updatedAt: now,
      });
    }

    return { recorded: args.injuries.length, healed };
  },
});

/**
 * Close out every open injury for a season (B2).
 *
 * Runs as the `injuries_healed` rollover stage, against the SOURCE season. A
 * season's injuries belong to that season — the new season's roster starts with
 * no rows at all — so this is not what makes a player available next year. It
 * is what stops the year that just ended from being archived with players still
 * listed as owing games they will now never miss.
 *
 * `gamesOut` is deliberately PRESERVED rather than zeroed. The row then reads
 * "healed with three games still owed", which is the only record that this
 * injury was ended by the offseason rather than by playing through it. Nothing
 * decides availability from the countdown alone — `isAvailable` in
 * `pbp/injuries.ts` returns early on any status but "out", and every UI filter
 * is an AND on both fields — so keeping it costs nothing and buys the audit.
 *
 * NOT gated on `injuriesEnabled`. A league that switches injuries off mid-
 * dynasty still has rows on the board, and leaving them open would make the
 * kill switch a way to strand data rather than a way to stop generating it.
 *
 * Idempotent by construction: it only touches rows the `by_seasonId_status`
 * index still reports as "out", so a second run finds none and heals zero.
 * That is what makes it safe to retry under the rollover's stage lease.
 */
export const healSeasonInjuries = internalMutation({
  args: { seasonId: v.id("seasons") },
  returns: v.object({ healed: v.number() }),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const open = await ctx.db
      .query("playerInjuries")
      .withIndex("by_seasonId_status", (q) =>
        q.eq("seasonId", args.seasonId).eq("status", "out"),
      )
      .collect();
    for (const row of open) {
      await ctx.db.patch(row._id, { status: "healed", updatedAt: now });
    }
    return { healed: open.length };
  },
});
