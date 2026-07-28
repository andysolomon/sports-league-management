import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";
import {
  normalizeDynastyConfigPatch,
  resolveDynastyConfig,
  type DynastyConfig,
} from "./lib/dynastyConfig";

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
