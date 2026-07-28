import { v, type Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";
import {
  normalizeDynastyConfigPatch,
  resolveDynastyConfig,
  type DynastyConfig,
} from "./lib/dynastyConfig";
import {
  INITIAL_OFFSEASON_PHASE,
  completePhase,
  phaseGate,
  type DraftPhaseStatus,
} from "./lib/offseasonPhases";

/*
 * Dynasty Mode — offseason pipeline (Epic B).
 *
 * Home for the persisted offseason phase machine, recruit scouting, transfers,
 * JV→Varsity promotions, position changes and training allocation. Empty in F1
 * beyond the readiness probe below; each later slice adds its functions here
 * rather than growing `sports.ts` (already ~7.5k lines).
 *
 * ## Rules for everything added to this module
 *
 * 1. Every WRITE is an `internalMutation` (WSM-000096). A public `mutation`
 *    here would be reachable by an anonymous `ConvexHttpClient` over the
 *    Internet. `__tests__/writeMutationsAreInternal.test.ts` fails `tsc` if one
 *    leaks — add new public READ queries to `AllowedPublicDynastyReads` there,
 *    which is a deliberate, security-reviewed act.
 * 2. Every function declares a `returns:` validator, and any DTO mapper pins
 *    its return type with `Infer<typeof someDtoValidator>` (WSM-000166).
 * 3. Per-team actions authorize on a `teamId` via `authorizeTeamMutation` /
 *    `resolveTeamRole` in the Next layer — never a bare "is org admin" check.
 *    That is what keeps multi-coach online dynasty possible without a rewrite.
 * 4. Reach this module from the Next layer through the compile-checked
 *    `dynastyRef` helpers in `src/lib/data-api.ts`, never a raw string.
 * 5. Hidden prospect truth (`trueAttributesJson`) must never appear in a
 *    `returns:` validator on a query reachable from a page or server action.
 */

/** Module readiness probe — see `lib/moduleStatus.ts` for why this exists. */
export const moduleStatus = query({
  args: {},
  returns: moduleStatusValidator,
  handler: async () => ({
    module: DYNASTY_MODULES.dynasty,
    epic: "B",
    ready: true,
  }),
});

/*
 * ── Per-league Dynasty settings (F5) ────────────────────────────────────────
 */

const dynastyConfigValidator = v.object({
  scoringDepthEnabled: v.boolean(),
  penaltiesEnabled: v.boolean(),
  situationalAiEnabled: v.boolean(),
  balanceTuningEnabled: v.boolean(),
  injuriesEnabled: v.boolean(),
  schemesEnabled: v.boolean(),
  weatherEnabled: v.boolean(),
  injurySeverityScale: v.number(),
  transfersEnabled: v.boolean(),
  transferVolume: v.string(),
  scoutingPointsPerOffseason: v.number(),
  trainingPointsPerOffseason: v.number(),
  targetRosterSize: v.number(),
  jobSecurityEnabled: v.boolean(),
  pollsEnabled: v.boolean(),
});

/**
 * A league's effective settings — always fully populated.
 *
 * Returns defaults for a league with no stored row rather than null, so every
 * caller gets a usable config and no call site has to remember to default.
 * That is the whole reason absence is legal.
 */
export const getDynastyConfig = query({
  args: { leagueId: v.id("leagues") },
  returns: dynastyConfigValidator,
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("dynastyConfig")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .first();
    return resolveDynastyConfig(row);
  },
});

/**
 * Patch a league's settings. Partial by design — the UI saves one section at a
 * time, and an omitted knob keeps its current value rather than resetting.
 *
 * `internalMutation` (WSM-000096): the admin gate lives in the server action.
 */
export const setDynastyConfig = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    actorUserId: v.string(),
    patch: v.object({
      scoringDepthEnabled: v.optional(v.boolean()),
      penaltiesEnabled: v.optional(v.boolean()),
      situationalAiEnabled: v.optional(v.boolean()),
      balanceTuningEnabled: v.optional(v.boolean()),
      injuriesEnabled: v.optional(v.boolean()),
      schemesEnabled: v.optional(v.boolean()),
      weatherEnabled: v.optional(v.boolean()),
      injurySeverityScale: v.optional(v.number()),
      transfersEnabled: v.optional(v.boolean()),
      transferVolume: v.optional(v.string()),
      scoutingPointsPerOffseason: v.optional(v.number()),
      trainingPointsPerOffseason: v.optional(v.number()),
      targetRosterSize: v.optional(v.number()),
      jobSecurityEnabled: v.optional(v.boolean()),
      pollsEnabled: v.optional(v.boolean()),
    }),
  },
  returns: dynastyConfigValidator,
  handler: async (ctx, args) => {
    const league = await ctx.db.get(args.leagueId);
    if (!league) throw new Error("league_not_found");

    const existing = await ctx.db
      .query("dynastyConfig")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .first();

    // Clamp and drop unknown keys before they reach storage, so an
    // out-of-range value can never be persisted and re-read later.
    const patch = normalizeDynastyConfigPatch(
      args.patch as Partial<DynastyConfig>,
    );
    const merged = resolveDynastyConfig({ ...(existing ?? {}), ...patch });

    const payload = {
      leagueId: args.leagueId,
      ...merged,
      updatedAt: new Date().toISOString(),
      updatedBy: args.actorUserId,
    };

    if (existing) {
      await ctx.db.replace(existing._id, payload);
    } else {
      await ctx.db.insert("dynastyConfig", payload);
    }

    return merged;
  },
});

/*
 * ── Persisted offseason phase machine (B1) ──────────────────────────────────
 */

const offseasonValidator = v.object({
  id: v.string(),
  leagueId: v.string(),
  seasonId: v.string(),
  phase: v.string(),
  completedPhases: v.array(v.string()),
  scoutingPointsTotal: v.number(),
  scoutingPointsSpent: v.number(),
  trainingPointsTotal: v.number(),
  trainingPointsSpent: v.number(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

type OffseasonDoc = Doc<"offseasons">;

/**
 * `Infer` pins the mapper's return to the validator (WSM-000166). If a field
 * is added to one and not the other this stops compiling, rather than throwing
 * a data-dependent 500 the first time a row happens to carry the new field.
 */
function toOffseasonDto(row: OffseasonDoc): Infer<typeof offseasonValidator> {
  return {
    id: row._id as string,
    leagueId: row.leagueId as string,
    seasonId: row.seasonId as string,
    phase: row.phase,
    completedPhases: row.completedPhases,
    scoutingPointsTotal: row.scoutingPointsTotal,
    scoutingPointsSpent: row.scoutingPointsSpent,
    trainingPointsTotal: row.trainingPointsTotal,
    trainingPointsSpent: row.trainingPointsSpent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The stored offseason for a season, or `null` if one was never opened.
 *
 * Null is honest here and the caller must handle it: a league that entered its
 * offseason before this table existed has no row, and `resolveOffseasonState`
 * in `lib/offseasonPhases.ts` is where that absence is turned into something
 * renderable. Defaulting here would hide which leagues still need opening.
 */
export const getOffseason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.union(offseasonValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("offseasons")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .first();
    return row ? toOffseasonDto(row) : null;
  },
});

/**
 * Open the offseason for a season, or return the one already open.
 *
 * Idempotent by design — it is safe to call on every admin page load, which is
 * what makes the row's existence something the UI never has to orchestrate.
 */
export const beginOffseason = internalMutation({
  args: { seasonId: v.id("seasons"), actorUserId: v.string() },
  returns: offseasonValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("offseasons")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .first();
    if (existing) return toOffseasonDto(existing);

    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    /*
     * An offseason prepares a season that has not started. Opening one on an
     * active or completed season would let phase actions mutate rosters that
     * results have already been recorded against.
     */
    if (season.status !== "upcoming") throw new Error("season_not_upcoming");

    const configRow = await ctx.db
      .query("dynastyConfig")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
      .first();
    const config = resolveDynastyConfig(configRow);

    const now = new Date().toISOString();
    const id = await ctx.db.insert("offseasons", {
      leagueId: season.leagueId,
      seasonId: args.seasonId,
      phase: INITIAL_OFFSEASON_PHASE,
      completedPhases: ["rollover"],
      scoutingPointsTotal: config.scoutingPointsPerOffseason,
      scoutingPointsSpent: 0,
      trainingPointsTotal: config.trainingPointsPerOffseason,
      trainingPointsSpent: 0,
      configJson: JSON.stringify(config),
      createdAt: now,
      updatedAt: now,
      updatedBy: args.actorUserId,
    });
    const row = await ctx.db.get(id);
    if (!row) throw new Error("offseason_not_found");
    return toOffseasonDto(row);
  },
});

const OFFSEASON_LEASE_MS = 30_000;

/**
 * Move an offseason to its next phase.
 *
 * Compare-and-set on `expectedPhase`. Convex serializes concurrent mutations,
 * so two admins who both read phase `draft` and both click Advance arrive here
 * one after the other: the first commits, and the second finds its
 * `expectedPhase` stale. That second caller is told `phase_busy` rather than
 * being silently no-opped, because it did not get what it asked for — someone
 * else moved the offseason underneath it.
 *
 * The exception is a caller whose target is already the current phase. That is
 * a retry of a request that landed, so it returns `changed: false` instead of
 * erroring, and `completedPhases` behaves as a set either way.
 */
export const advanceOffseasonPhase = internalMutation({
  args: {
    seasonId: v.id("seasons"),
    expectedPhase: v.string(),
    to: v.string(),
    ownerId: v.string(),
    actorUserId: v.string(),
    draftStatus: v.string(),
  },
  returns: v.object({
    changed: v.boolean(),
    offseason: offseasonValidator,
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("offseasons")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .first();
    if (!row) throw new Error("offseason_not_found");

    /*
     * Already where the caller wants to be. A retry and a lost race send
     * BYTE-IDENTICAL payloads — same `expectedPhase`, same `to` — so the only
     * thing that separates them is who asked. `leaseOwnerId` records who made
     * the move, which is what earns the lease its place on the row today
     * rather than only in B2+.
     *
     * No recorded owner means nobody claims to have moved it (a fresh row
     * asked to stay where it is), which is a no-op, not a conflict.
     */
    if (row.phase === args.to) {
      if (
        row.leaseOwnerId === undefined ||
        row.leaseOwnerId === args.ownerId
      ) {
        return { changed: false, offseason: toOffseasonDto(row) };
      }
      throw new Error("phase_busy");
    }

    const decision = phaseGate({
      from: row.phase,
      to: args.to,
      draftStatus: args.draftStatus as DraftPhaseStatus,
    });
    if (!decision.ok) throw new Error(decision.reason);

    /*
     * The CAS. Checked AFTER the gate so a genuinely invalid request (a
     * backward phase, a skipped phase) reports what is wrong with it rather
     * than being masked as a concurrency loss.
     */
    if (row.phase !== args.expectedPhase) throw new Error("phase_busy");

    const now = Date.now();
    const leaseExpiresAt = row.leaseExpiresAt
      ? Date.parse(row.leaseExpiresAt)
      : 0;
    const foreignLease =
      row.leaseOwnerId !== undefined &&
      row.leaseOwnerId !== args.ownerId &&
      Number.isFinite(leaseExpiresAt) &&
      leaseExpiresAt > now;
    if (foreignLease) throw new Error("phase_busy");

    await ctx.db.patch(row._id, {
      phase: args.to,
      completedPhases: completePhase(row.completedPhases, row.phase),
      leasePhase: args.to,
      leaseOwnerId: args.ownerId,
      leaseExpiresAt: new Date(now + OFFSEASON_LEASE_MS).toISOString(),
      updatedAt: new Date(now).toISOString(),
      updatedBy: args.actorUserId,
    });
    const updated = await ctx.db.get(row._id);
    if (!updated) throw new Error("offseason_not_found");
    return { changed: true, offseason: toOffseasonDto(updated) };
  },
});
