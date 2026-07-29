import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
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
import {
  MIN_SCOUT_LEVEL,
  RECRUITING_CLASS_PER_TEAM,
  applyScoutingNoise,
  isPotentialTier,
  nextScoutCost,
} from "./lib/scouting";
import {
  generateTransferSlate,
  matchTransfersIn,
  type TransferCandidate,
} from "./lib/transfers";
import { VARSITY, squadChange } from "./lib/promotions";
import {
  applyTraining,
  totalAllocatedPoints,
  trainingGate,
} from "./lib/training";
import {
  attributeGroupForPosition,
  derivePositionGroup,
} from "./lib/positions";
import { MAX_TARGET_ROSTER_SIZE } from "./lib/offseason";
import { emitDynastyEvent } from "./lib/events";
import { transferResolvedDedupeKey } from "./lib/narrative";
import { COACH_ROLE_HEAD } from "./lib/coach";
import {
  coachSkillsStateFromRow,
  ratingsFromSkillState,
} from "./lib/coachSkills";

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

async function headCoachDevelopmentRatingForTeam(
  ctx: MutationCtx,
  teamId: Id<"teams">,
): Promise<number | undefined> {
  const coach = await ctx.db
    .query("coaches")
    .withIndex("by_teamId_role", (q) =>
      q.eq("teamId", teamId).eq("role", COACH_ROLE_HEAD),
    )
    .unique();
  if (!coach) return undefined;
  const ratings = ratingsFromSkillState(coachSkillsStateFromRow(coach));
  return ratings.developmentRating ?? undefined;
}

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
  recruitingEnabled: v.boolean(),
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
      recruitingEnabled: v.optional(v.boolean()),
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
    const row = await ensureOffseason(ctx, args.seasonId, args.actorUserId);
    return toOffseasonDto(row);
  },
});

/**
 * The offseason row for a season, opening one if it does not exist yet.
 *
 * Shared with `scoutProspect` (B3), which needs the budget on the row and
 * cannot require that an admin visited the hub first — a coach spending
 * scouting points is not necessarily the person who opens the offseason, and
 * making the budget's existence depend on someone else's page load would turn
 * a shared resource into a race.
 */
async function ensureOffseason(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
  actorUserId: string,
): Promise<Doc<"offseasons">> {
  const existing = await ctx.db
    .query("offseasons")
    .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
    .first();
  if (existing) return existing;

  const season = await ctx.db.get(seasonId);
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
    seasonId,
    phase: INITIAL_OFFSEASON_PHASE,
    completedPhases: ["rollover"],
    scoutingPointsTotal: config.scoutingPointsPerOffseason,
    scoutingPointsSpent: 0,
    trainingPointsTotal: config.trainingPointsPerOffseason,
    trainingPointsSpent: 0,
    configJson: JSON.stringify(config),
    createdAt: now,
    updatedAt: now,
    updatedBy: actorUserId,
  });
  const row = await ctx.db.get(id);
  if (!row) throw new Error("offseason_not_found");
  return row;
}

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

/*
 * ── Incoming freshman class: scouting and signing (B3) ──────────────────────
 */

const prospectValidator = v.object({
  id: v.string(),
  leagueId: v.string(),
  seasonId: v.string(),
  name: v.string(),
  position: v.string(),
  positionGroup: v.string(),
  archetype: v.string(),
  hometown: v.union(v.string(), v.null()),
  scoutLevel: v.number(),
  projectedLow: v.number(),
  projectedHigh: v.number(),
  scoutedAttributesJson: v.string(),
  signedTeamId: v.union(v.string(), v.null()),
  playerId: v.union(v.string(), v.null()),
});

type ProspectDoc = Doc<"recruitProspects">;

/**
 * The public face of a prospect.
 *
 * Note what is NOT here: `trueAttributesJson`, `trueOverall`, `potentialTier`.
 * Their absence is the entire mechanic, not an oversight, and it is asserted
 * from two directions — `Infer` pins this mapper to the validator above
 * (WSM-000166), and `__tests__/prospectsHideTruth.test.ts` fails if any of the
 * three names ever appears in the validator. Adding one here would not be a
 * leak of a private field; it would delete recruiting.
 */
function toProspectDto(row: ProspectDoc): Infer<typeof prospectValidator> {
  return {
    id: row._id as string,
    leagueId: row.leagueId as string,
    seasonId: row.seasonId as string,
    name: row.name,
    position: row.position,
    positionGroup: row.positionGroup,
    archetype: row.archetype,
    hometown: row.hometown,
    scoutLevel: row.scoutLevel,
    projectedLow: row.projectedLow,
    projectedHigh: row.projectedHigh,
    scoutedAttributesJson: row.scoutedAttributesJson,
    signedTeamId: (row.signedTeamId as string | undefined) ?? null,
    playerId: (row.playerId as string | undefined) ?? null,
  };
}

/** A season's recruiting board, blurred to each prospect's scout level. */
export const listProspects = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(prospectValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("recruitProspects")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();
    return rows.map(toProspectDto);
  },
});

/**
 * Persist a generated class.
 *
 * Generation itself runs in the Next layer (`src/lib/dynasty/prospects.ts`)
 * because it reuses the name and attribute generators that live under `src/`;
 * this end owns storage and the level-0 band.
 *
 * Idempotent on the season, not on the rows: a class that already exists is
 * returned untouched rather than appended to. The rollover stage that calls
 * this can be retried after a lost response, and a second class on the same
 * board would be indistinguishable from a very good recruiting year.
 */
export const createProspectClass = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    prospects: v.array(
      v.object({
        name: v.string(),
        position: v.string(),
        positionGroup: v.string(),
        archetype: v.string(),
        hometown: v.union(v.string(), v.null()),
        trueAttributesJson: v.string(),
        trueOverall: v.number(),
        potentialTier: v.string(),
      }),
    ),
  },
  returns: v.object({ created: v.number(), alreadyExisted: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("recruitProspects")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();
    if (existing.length > 0) {
      return { created: existing.length, alreadyExisted: true };
    }

    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.leagueId !== args.leagueId) {
      throw new Error("season_league_mismatch");
    }

    const now = new Date().toISOString();
    let created = 0;
    for (const p of args.prospects) {
      /*
       * The row's own id is the scouting seed, so the band cannot be computed
       * until after the insert — hence insert-then-patch rather than a single
       * write. Seeding from anything the caller supplies instead (a name, an
       * index) would let two classes with the same shape share bands.
       */
      const id = await ctx.db.insert("recruitProspects", {
        leagueId: args.leagueId,
        seasonId: args.seasonId,
        name: p.name,
        position: p.position,
        positionGroup: p.positionGroup,
        archetype: p.archetype,
        hometown: p.hometown,
        trueAttributesJson: p.trueAttributesJson,
        trueOverall: p.trueOverall,
        potentialTier: isPotentialTier(p.potentialTier)
          ? p.potentialTier
          : "steady",
        scoutLevel: MIN_SCOUT_LEVEL,
        scoutedAttributesJson: "{}",
        projectedLow: 0,
        projectedHigh: 0,
        createdAt: now,
      });
      const report = applyScoutingNoise({
        prospectId: id as string,
        scoutLevel: MIN_SCOUT_LEVEL,
        trueOverall: p.trueOverall,
        trueAttributes: parseAttributes(p.trueAttributesJson),
      });
      await ctx.db.patch(id, {
        scoutedAttributesJson: JSON.stringify(report.scoutedAttributes),
        projectedLow: report.projectedLow,
        projectedHigh: report.projectedHigh,
      });
      created += 1;
    }
    return { created, alreadyExisted: false };
  },
});

function parseAttributes(json: string): Record<string, number> {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Buy one more level of precision on a prospect.
 *
 * `teamId` is taken and validated even though the class and the budget are
 * league-wide today. It is the multiplayer-critical detail from the roadmap:
 * the same mutation has to serve a Wave 5 coach scoped to one team, and the
 * argument that would make that possible cannot be retrofitted onto call sites
 * that never passed it. What it buys today is that a coach of team A cannot
 * spend team B's authority, which is the shape the later change needs.
 *
 * Scouting is shared: a league-wide budget on the offseason row, and a level
 * that every team sees. Per-team scouting needs a `(prospectId, teamId)` join
 * table, which is a Wave 5 addition to this row rather than a change to it.
 */
export const scoutProspect = internalMutation({
  args: {
    prospectId: v.id("recruitProspects"),
    teamId: v.id("teams"),
    actorUserId: v.string(),
  },
  returns: v.object({
    prospect: prospectValidator,
    scoutingPointsSpent: v.number(),
    scoutingPointsTotal: v.number(),
  }),
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) throw new Error("prospect_not_found");
    if (prospect.playerId) throw new Error("prospect_already_signed");

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("team_not_found");
    if (team.leagueId !== prospect.leagueId) {
      throw new Error("team_league_mismatch");
    }

    const cost = nextScoutCost(prospect.scoutLevel);
    if (cost === null) throw new Error("prospect_fully_scouted");

    const offseason = await ensureOffseason(
      ctx,
      prospect.seasonId,
      args.actorUserId,
    );
    if (offseason.scoutingPointsSpent + cost > offseason.scoutingPointsTotal) {
      throw new Error("scouting_budget_exhausted");
    }

    const report = applyScoutingNoise({
      prospectId: args.prospectId as string,
      scoutLevel: prospect.scoutLevel + 1,
      trueOverall: prospect.trueOverall,
      trueAttributes: parseAttributes(prospect.trueAttributesJson),
    });

    await ctx.db.patch(args.prospectId, {
      scoutLevel: report.scoutLevel,
      scoutedAttributesJson: JSON.stringify(report.scoutedAttributes),
      projectedLow: report.projectedLow,
      projectedHigh: report.projectedHigh,
    });
    await ctx.db.patch(offseason._id, {
      scoutingPointsSpent: offseason.scoutingPointsSpent + cost,
      updatedAt: new Date().toISOString(),
      updatedBy: args.actorUserId,
    });

    const updated = await ctx.db.get(args.prospectId);
    if (!updated) throw new Error("prospect_not_found");
    return {
      prospect: toProspectDto(updated),
      scoutingPointsSpent: offseason.scoutingPointsSpent + cost,
      scoutingPointsTotal: offseason.scoutingPointsTotal,
    };
  },
});

/**
 * Sign a prospect: he becomes a real grade-9 player on the team's roster.
 *
 * The attribute snapshot written here is the TRUE map, not the scouted one.
 * That is the moment of truth the whole slice builds toward — a coach who
 * signed on a 62–76 range finds out he got a 64. Writing the blurred numbers
 * instead would make the uncertainty permanent rather than resolved, and every
 * downstream system (depth chart, SPRT, progression) would be reasoning about
 * a guess.
 *
 * Idempotent through `playerId`: set means signed, so a retry returns the
 * existing player rather than creating a second one. This is checked before
 * anything is written, because the failure it guards against — a duplicate
 * player on a roster — is not something a later step could undo.
 */
export const signProspect = internalMutation({
  args: {
    prospectId: v.id("recruitProspects"),
    teamId: v.id("teams"),
    actorUserId: v.string(),
  },
  returns: v.object({
    prospect: prospectValidator,
    playerId: v.string(),
    alreadySigned: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) throw new Error("prospect_not_found");

    if (prospect.playerId) {
      /*
       * Already signed. A retry by the SAME team is the request landing twice
       * and gets the player back; a different team asking is a genuine loss —
       * someone else got him — and has to be told so rather than handed a
       * player it does not own.
       */
      if (prospect.signedTeamId !== args.teamId) {
        throw new Error("prospect_already_signed");
      }
      return {
        prospect: toProspectDto(prospect),
        playerId: prospect.playerId as string,
        alreadySigned: true,
      };
    }

    const [team, season] = await Promise.all([
      ctx.db.get(args.teamId),
      ctx.db.get(prospect.seasonId),
    ]);
    if (!team) throw new Error("team_not_found");
    if (!season) throw new Error("season_not_found");
    if (team.leagueId !== prospect.leagueId) {
      throw new Error("team_league_mismatch");
    }
    if (season.rosterLocked === true) throw new Error("season_locked");

    /*
     * The class holds exactly `RECRUITING_CLASS_PER_TEAM` names per team, so
     * this cap is what keeps it a contest: without it one program could sign
     * every prospect in the league and the board would be a queue.
     */
    const classRows = await ctx.db
      .query("recruitProspects")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", prospect.seasonId))
      .collect();
    const signedByTeam = classRows.filter(
      (row) => row.signedTeamId === args.teamId,
    ).length;
    if (signedByTeam >= RECRUITING_CLASS_PER_TEAM) {
      throw new Error("recruiting_class_full");
    }

    const now = new Date().toISOString();
    const playerId = await ctx.db.insert("players", {
      name: prospect.name,
      leagueId: prospect.leagueId,
      teamId: args.teamId,
      position: prospect.position,
      positionGroup: null,
      jerseyNumber: null,
      dateOfBirth: null,
      status: "active",
      headshotUrl: null,
      experienceYears: null,
      grade: 9,
      squad: "JV",
      hometown: prospect.hometown,
      synthetic: true,
    });

    /*
     * Roster assignment written directly rather than through
     * `assignPlayerToRosterCore` in `sports.ts`, which is module-private and
     * carries guards a brand-new player cannot fail (already-on-roster,
     * not-on-team). What IS reproduced is the part that matters: `depthRank`
     * continues the slot's existing order instead of restarting at 1.
     */
    const teamAssignments = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", prospect.seasonId).eq("teamId", args.teamId),
      )
      .collect();
    const depthRank =
      teamAssignments
        .filter(
          (row) =>
            row.status === "active" && row.positionSlot === prospect.position,
        )
        .reduce((max, row) => Math.max(max, row.depthRank), 0) + 1;

    await ctx.db.insert("rosterAssignments", {
      seasonId: prospect.seasonId,
      teamId: args.teamId,
      playerId,
      leagueId: prospect.leagueId,
      depthRank,
      positionSlot: prospect.position,
      status: "active",
      assignedAt: now,
      assignedBy: args.actorUserId,
    });

    await ctx.db.insert("playerAttributes", {
      playerId,
      seasonId: prospect.seasonId,
      positionGroup: prospect.positionGroup,
      attributesJson: prospect.trueAttributesJson,
      pffSourceJson: null,
      maddenSourceJson: null,
      pffWeight: 0,
      maddenWeight: 0,
      weightedOverall: prospect.trueOverall,
      ingestedAt: now,
    });

    await ctx.db.insert("rosterAuditLog", {
      leagueId: prospect.leagueId,
      teamId: args.teamId,
      seasonId: prospect.seasonId,
      actorUserId: args.actorUserId,
      action: "sign_prospect",
      beforeJson: null,
      afterJson: JSON.stringify({
        prospectId: args.prospectId as string,
        playerId: playerId as string,
        name: prospect.name,
        position: prospect.position,
        scoutLevel: prospect.scoutLevel,
      }),
      createdAt: now,
    });

    await ctx.db.patch(args.prospectId, {
      signedTeamId: args.teamId,
      playerId,
      signedAt: now,
    });

    const updated = await ctx.db.get(args.prospectId);
    if (!updated) throw new Error("prospect_not_found");
    return {
      prospect: toProspectDto(updated),
      playerId: playerId as string,
      alreadySigned: false,
    };
  },
});

/*
 * ── Offseason transfers (B4) ────────────────────────────────────────────────
 */

const transferValidator = v.object({
  id: v.string(),
  leagueId: v.string(),
  seasonId: v.string(),
  playerId: v.string(),
  playerName: v.string(),
  position: v.string(),
  grade: v.union(v.number(), v.null()),
  direction: v.string(),
  fromTeamId: v.string(),
  fromTeamName: v.string(),
  toTeamId: v.union(v.string(), v.null()),
  toTeamName: v.union(v.string(), v.null()),
  reason: v.string(),
  likelihood: v.number(),
  status: v.string(),
  /**
   * Whether the losing coach has released him yet. Derived, not stored: it is a
   * property of the `out` row, and duplicating it onto every offer would need
   * a second write on every retention — the exact denormalisation that goes
   * stale first.
   */
  released: v.boolean(),
});

type TransferDoc = Doc<"transferEvents">;

function toTransferDto(
  row: TransferDoc,
  names: {
    playerName: string;
    position: string;
    grade: number | null;
    fromTeamName: string;
    toTeamName: string | null;
  },
  released: boolean,
): Infer<typeof transferValidator> {
  return {
    id: row._id as string,
    leagueId: row.leagueId as string,
    seasonId: row.seasonId as string,
    playerId: row.playerId as string,
    playerName: names.playerName,
    position: names.position,
    grade: names.grade,
    direction: row.direction,
    fromTeamId: row.fromTeamId as string,
    fromTeamName: names.fromTeamName,
    toTeamId: (row.toTeamId as string | null) ?? null,
    toTeamName: names.toTeamName,
    reason: row.reason,
    likelihood: row.likelihood,
    status: row.status,
    released,
  };
}

/**
 * A season's transfer window, both directions.
 *
 * Player and team NAMES are resolved here rather than in the panel. The slate
 * is bounded by roster size and every row needs three lookups; doing them in
 * the Next layer would be an N+1 across the Convex boundary, which is the exact
 * shape F2/F3 existed to remove.
 */
export const listTransfers = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(transferValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("transferEvents")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();
    if (rows.length === 0) return [];

    const players = new Map<string, Doc<"players"> | null>();
    const teams = new Map<string, Doc<"teams"> | null>();
    for (const row of rows) {
      if (!players.has(row.playerId as string)) {
        players.set(row.playerId as string, await ctx.db.get(row.playerId));
      }
      for (const teamId of [row.fromTeamId, row.toTeamId]) {
        if (teamId && !teams.has(teamId as string)) {
          teams.set(teamId as string, await ctx.db.get(teamId));
        }
      }
    }

    // One pass to learn who has been released, so `released` costs no extra
    // reads per offer.
    const releasedPlayers = new Set(
      rows
        .filter((row) => row.direction === "out" && row.status === "accepted")
        .map((row) => row.playerId as string),
    );

    return rows.map((row) => {
      const player = players.get(row.playerId as string) ?? null;
      const from = teams.get(row.fromTeamId as string) ?? null;
      const to = row.toTeamId
        ? (teams.get(row.toTeamId as string) ?? null)
        : null;
      return toTransferDto(
        row,
        {
          playerName: player?.name ?? "Unknown player",
          position: player?.position ?? "ATH",
          grade: player?.grade ?? null,
          fromTeamName: from?.name ?? "Unknown team",
          toTeamName: to ? to.name : null,
        },
        releasedPlayers.has(row.playerId as string),
      );
    });
  },
});

/**
 * Open the transfer window for a season.
 *
 * Idempotent on the season: an existing window is returned untouched. The slate
 * is seeded per `(playerId, seasonId)`, so a retry would regenerate the same
 * names anyway — but "same names" written twice is still two rows per decision,
 * and a coach would be asked about the same player repeatedly.
 *
 * Not gated on the offseason phase. A commissioner who opens the window early
 * has made a scheduling choice; the phase machine already governs when the
 * panel is reachable, and enforcing it twice would mean a phase advance could
 * strand a half-generated window.
 */
export const generateTransferWindow = internalMutation({
  args: { seasonId: v.id("seasons"), actorUserId: v.string() },
  returns: v.object({
    outbound: v.number(),
    offers: v.number(),
    alreadyExisted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("transferEvents")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();
    if (existing.length > 0) {
      return {
        outbound: existing.filter((r) => r.direction === "out").length,
        offers: existing.filter((r) => r.direction === "in").length,
        alreadyExisted: true,
      };
    }

    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");

    const configRow = await ctx.db
      .query("dynastyConfig")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
      .first();
    const config = resolveDynastyConfig(configRow);

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
      .collect();

    /*
     * Ratings come from the season's own `playerAttributes` snapshot, which the
     * rollover's `attributes_copied` stage writes. Reading the live player row
     * instead would rate everyone on last year's form, so a junior who
     * developed would still look like the freshman he was.
     */
    const overallByPlayer = new Map<string, number>();
    for (const row of await ctx.db
      .query("playerAttributes")
      // Prefix of `by_seasonId_positionGroup` — one indexed range for the
      // season rather than a scan of every snapshot ever ingested.
      .withIndex("by_seasonId_positionGroup", (q) =>
        q.eq("seasonId", args.seasonId),
      )
      .collect()) {
      if (row.weightedOverall !== null) {
        overallByPlayer.set(row.playerId as string, row.weightedOverall);
      }
    }

    const candidates: TransferCandidate[] = [];
    const rosterCount = new Map<string, number>();
    const positionCount = new Map<string, number>();
    for (const team of teams) {
      const assignments = await ctx.db
        .query("rosterAssignments")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", args.seasonId).eq("teamId", team._id),
        )
        .collect();
      const active = assignments.filter((row) => row.status === "active");
      rosterCount.set(team._id as string, active.length);

      for (const assignment of active) {
        const player = await ctx.db.get(assignment.playerId);
        if (!player) continue;
        const key = `${team._id as string}:${assignment.positionSlot}`;
        positionCount.set(key, (positionCount.get(key) ?? 0) + 1);
        candidates.push({
          playerId: assignment.playerId as string,
          teamId: team._id as string,
          position: assignment.positionSlot,
          depthRank: assignment.depthRank,
          overall: overallByPlayer.get(assignment.playerId as string) ?? 60,
          grade: player.grade ?? null,
          status: player.status,
        });
      }
    }

    const outbound = generateTransferSlate({
      seasonId: args.seasonId as string,
      candidates,
      volume: config.transferVolume,
      enabled: config.transfersEnabled,
    });

    const offers = matchTransfersIn({
      seasonId: args.seasonId as string,
      outbound,
      destinationsFor: (transfer) =>
        teams.map((team) => ({
          teamId: team._id as string,
          rosterCount: rosterCount.get(team._id as string) ?? 0,
          countAtPosition:
            positionCount.get(`${team._id as string}:${transfer.position}`) ?? 0,
        })),
    });

    const now = new Date().toISOString();
    const byPlayer = new Map(outbound.map((t) => [t.playerId, t]));
    for (const transfer of outbound) {
      await ctx.db.insert("transferEvents", {
        leagueId: season.leagueId,
        seasonId: args.seasonId,
        playerId: transfer.playerId as Id<"players">,
        direction: "out",
        fromTeamId: transfer.fromTeamId as Id<"teams">,
        toTeamId: null,
        reason: transfer.reason,
        likelihood: transfer.likelihood,
        status: "pending",
        createdAt: now,
      });
    }
    for (const offer of offers) {
      const source = byPlayer.get(offer.playerId);
      await ctx.db.insert("transferEvents", {
        leagueId: season.leagueId,
        seasonId: args.seasonId,
        playerId: offer.playerId as Id<"players">,
        direction: "in",
        fromTeamId: offer.fromTeamId as Id<"teams">,
        toTeamId: offer.toTeamId as Id<"teams">,
        reason: source?.reason ?? "opportunity",
        likelihood: source?.likelihood ?? 0,
        status: "pending",
        createdAt: now,
      });
    }

    return {
      outbound: outbound.length,
      offers: offers.length,
      alreadyExisted: false,
    };
  },
});

/**
 * Accept or reject one transfer decision.
 *
 * `teamId` is the team acting, and it must be the side that owns the row — the
 * losing coach for an `out`, the destination for an `in`. Passing it explicitly
 * rather than deriving it from the row is the multiplayer hook the roadmap
 * requires: the Next action authorizes the caller against this id, and in Wave
 * 5 the same mutation serves a coach scoped to one team.
 *
 * Resolution cascades. Retaining a player withdraws every offer for him;
 * signing him withdraws every rival offer. Both happen here rather than in the
 * action so a coach cannot be shown an offer that a concurrent decision has
 * already invalidated.
 */
export const resolveTransfer = internalMutation({
  args: {
    transferId: v.id("transferEvents"),
    teamId: v.id("teams"),
    decision: v.string(),
    actorUserId: v.string(),
  },
  returns: v.object({
    status: v.string(),
    moved: v.boolean(),
    withdrawn: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.decision !== "accept" && args.decision !== "reject") {
      throw new Error("invalid_decision");
    }
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer) throw new Error("transfer_not_found");
    if (transfer.status !== "pending") throw new Error("transfer_not_pending");

    const owningTeamId =
      transfer.direction === "out" ? transfer.fromTeamId : transfer.toTeamId;
    if (!owningTeamId || owningTeamId !== args.teamId) {
      throw new Error("transfer_team_mismatch");
    }

    const now = new Date().toISOString();
    const siblings = (
      await ctx.db
        .query("transferEvents")
        .withIndex("by_playerId", (q) => q.eq("playerId", transfer.playerId))
        .collect()
    ).filter(
      (row) => row.seasonId === transfer.seasonId && row._id !== transfer._id,
    );

    async function withdraw(rows: TransferDoc[]): Promise<number> {
      let count = 0;
      for (const row of rows) {
        if (row.status !== "pending") continue;
        await ctx.db.patch(row._id, {
          status: "withdrawn",
          resolvedAt: now,
          resolvedBy: args.actorUserId,
        });
        count += 1;
      }
      return count;
    }

    const player = await ctx.db.get(transfer.playerId);
    const fromTeam = await ctx.db.get(transfer.fromTeamId);

    /* ── The losing coach's decision ───────────────────────────────────── */
    if (transfer.direction === "out") {
      const status = args.decision === "accept" ? "accepted" : "rejected";
      await ctx.db.patch(transfer._id, {
        status,
        resolvedAt: now,
        resolvedBy: args.actorUserId,
      });

      if (status === "rejected") {
        // Retained. Every offer for him dies with the decision.
        const withdrawn = await withdraw(
          siblings.filter((row) => row.direction === "in"),
        );
        await emitDynastyEvent(ctx, {
          leagueId: transfer.leagueId,
          seasonId: transfer.seasonId,
          teamId: transfer.fromTeamId,
          playerId: transfer.playerId,
          dedupeKey: transferResolvedDedupeKey(transfer._id as string),
          narrative: {
            type: "transfer_retained",
            playerName: player?.name ?? "A player",
            teamName: fromTeam?.name ?? "The program",
            position: player?.position ?? "ATH",
          },
        });
        return { status, moved: false, withdrawn };
      }

      /*
       * Released. No event yet — nothing has happened to any roster, and a
       * feed entry here would announce a move that may never occur.
       */
      return { status, moved: false, withdrawn: 0 };
    }

    /* ── A destination coach's decision ────────────────────────────────── */
    const outRow = siblings.find((row) => row.direction === "out");
    if (args.decision === "reject") {
      await ctx.db.patch(transfer._id, {
        status: "rejected",
        resolvedAt: now,
        resolvedBy: args.actorUserId,
      });
      return { status: "rejected", moved: false, withdrawn: 0 };
    }

    /*
     * A destination cannot sign a player his own coach has not released. The
     * check is here rather than only in the UI because the two decisions are
     * made by different people and can race.
     */
    if (!outRow || outRow.status !== "accepted") {
      throw new Error("transfer_not_released");
    }
    if (!player) throw new Error("player_not_found");

    const toTeam = await ctx.db.get(args.teamId);
    if (!toTeam) throw new Error("team_not_found");
    if (toTeam.leagueId !== transfer.leagueId) {
      throw new Error("team_league_mismatch");
    }
    const season = await ctx.db.get(transfer.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.rosterLocked === true) throw new Error("season_locked");

    /*
     * Re-checked at acceptance, not only at generation. The offer was made
     * against a roster count that recruiting, the draft or another transfer
     * may have moved since.
     */
    const destinationRoster = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", transfer.seasonId).eq("teamId", args.teamId),
      )
      .collect();
    const activeCount = destinationRoster.filter(
      (row) => row.status === "active",
    ).length;
    if (activeCount >= MAX_TARGET_ROSTER_SIZE) {
      throw new Error("roster_full");
    }

    // Move him: player row, roster assignment, depth chart.
    const assignments = (
      await ctx.db
        .query("rosterAssignments")
        .withIndex("by_playerId", (q) => q.eq("playerId", transfer.playerId))
        .collect()
    ).filter((row) => row.seasonId === transfer.seasonId);
    for (const row of assignments) {
      await ctx.db.delete(row._id);
    }

    const oldDepth = (
      await ctx.db
        .query("depthChartEntries")
        .withIndex("by_team_season", (q) =>
          q
            .eq("teamId", transfer.fromTeamId)
            .eq("seasonId", transfer.seasonId),
        )
        .collect()
    ).filter((row) => row.playerId === transfer.playerId);
    for (const row of oldDepth) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.patch(transfer.playerId, { teamId: args.teamId });

    const slot = player.position;
    const depthRank =
      destinationRoster
        .filter((row) => row.status === "active" && row.positionSlot === slot)
        .reduce((max, row) => Math.max(max, row.depthRank), 0) + 1;
    await ctx.db.insert("rosterAssignments", {
      seasonId: transfer.seasonId,
      teamId: args.teamId,
      playerId: transfer.playerId,
      leagueId: transfer.leagueId,
      depthRank,
      positionSlot: slot,
      status: "active",
      assignedAt: now,
      assignedBy: args.actorUserId,
    });

    await ctx.db.patch(transfer._id, {
      status: "accepted",
      resolvedAt: now,
      resolvedBy: args.actorUserId,
    });
    const withdrawn = await withdraw(
      siblings.filter((row) => row.direction === "in"),
    );

    await ctx.db.insert("rosterAuditLog", {
      leagueId: transfer.leagueId,
      teamId: args.teamId,
      seasonId: transfer.seasonId,
      actorUserId: args.actorUserId,
      action: "transfer_in",
      beforeJson: JSON.stringify({ teamId: transfer.fromTeamId as string }),
      afterJson: JSON.stringify({
        teamId: args.teamId as string,
        playerId: transfer.playerId as string,
        transferId: transfer._id as string,
      }),
      createdAt: now,
    });

    await emitDynastyEvent(ctx, {
      leagueId: transfer.leagueId,
      seasonId: transfer.seasonId,
      teamId: args.teamId,
      playerId: transfer.playerId,
      dedupeKey: transferResolvedDedupeKey(transfer._id as string),
      narrative: {
        type: "transfer_completed",
        playerName: player.name,
        fromTeamName: fromTeam?.name ?? "another program",
        toTeamName: toTeam.name,
        position: player.position,
      },
    });

    return { status: "accepted", moved: true, withdrawn };
  },
});

/*
 * ── Roster shaping: promotions, position changes, cuts (B5) ────────────────
 *
 * Three operations on one board, and zero new tables. A promotion is a patch
 * to `players.squad`; a position change is a patch to `players.position` plus
 * the season rows that mirror it; a cut is the free-agency release that has
 * shipped since WSM-000231. Inventing a `rosterMoves` table would have given
 * the offseason a second, quieter record of roster state that the roster pages
 * do not read — the audit log already answers "what happened", and the roster
 * itself answers "what is true".
 */

const rosterBoardPlayerValidator = v.object({
  playerId: v.string(),
  name: v.string(),
  position: v.string(),
  positionGroup: v.union(v.string(), v.null()),
  grade: v.union(v.number(), v.null()),
  squad: v.union(v.string(), v.null()),
  overall: v.union(v.number(), v.null()),
  depthRank: v.union(v.number(), v.null()),
  /** Ratings map, JSON-encoded. Null when the player has no rated season. */
  attributesJson: v.union(v.string(), v.null()),
});

/**
 * One team's roster for a season, with everything roster shaping needs.
 *
 * Attributes come along because `positionChangeFit` is computed in the panel,
 * per candidate position, as the coach scrubs the control — a round trip per
 * hover would be a worse version of the same answer.
 *
 * The per-player attribute read is one indexed `.first()` each, bounded by
 * roster size (~40). That is deliberately NOT the `by_seasonId_positionGroup`
 * prefix B4 switched to: that index would return every rated player in the
 * league for the season (~600) to serve one team.
 */
export const listRosterBoard = query({
  args: { seasonId: v.id("seasons"), teamId: v.id("teams") },
  returns: v.array(rosterBoardPlayerValidator),
  handler: async (ctx, args) => {
    const assignments = (
      await ctx.db
        .query("rosterAssignments")
        .withIndex("by_seasonId_teamId", (q) =>
          q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
        )
        .collect()
    ).filter((row) => row.status === "active");

    const rows: Infer<typeof rosterBoardPlayerValidator>[] = [];
    for (const assignment of assignments) {
      const player = await ctx.db.get(assignment.playerId);
      if (!player) continue;

      /*
       * Ratings resolve through `sourcePlayerId` when the player is a
       * workspace fork, matching `resolvePlayerOverall` in `sports.ts`. A fork
       * that read its own empty attribute row would show every player as
       * unrated.
       */
      const ratingPlayerId = player.sourcePlayerId ?? assignment.playerId;
      const attributes = await ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", ratingPlayerId).eq("seasonId", args.seasonId),
        )
        .first();

      rows.push({
        playerId: assignment.playerId as string,
        name: player.name,
        position: player.position,
        positionGroup: player.positionGroup ?? null,
        grade: player.grade ?? null,
        squad: player.squad ?? null,
        overall: attributes?.weightedOverall ?? null,
        depthRank: assignment.depthRank,
        attributesJson: attributes?.attributesJson ?? null,
      });
    }

    return rows.sort((a, b) =>
      a.position === b.position
        ? (a.depthRank ?? 0) - (b.depthRank ?? 0)
        : a.position < b.position
          ? -1
          : 1,
    );
  },
});

/**
 * Move a player between Varsity and JV.
 *
 * `teamId` is an argument rather than something derived from the player so the
 * Next layer's per-team gate and this check are about the SAME team: an action
 * that authorized team A and then patched a player who had already moved to
 * team B would be a real hole, and deriving the team here would hide it.
 */
export const setPlayerSquad = internalMutation({
  args: {
    playerId: v.id("players"),
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    squad: v.string(),
    actorUserId: v.string(),
  },
  returns: v.object({ squad: v.string(), changed: v.boolean() }),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("player_not_found");
    if (player.teamId !== args.teamId) throw new Error("player_not_on_team");

    const decision = squadChange({
      grade: player.grade ?? null,
      from: player.squad ?? null,
      to: args.squad,
    });
    if (!decision.ok) throw new Error(decision.reason);
    if (decision.kind === "noop") {
      return { squad: args.squad, changed: false };
    }

    await ctx.db.patch(args.playerId, { squad: args.squad });
    await ctx.db.insert("rosterAuditLog", {
      leagueId: player.leagueId,
      teamId: args.teamId,
      seasonId: args.seasonId,
      actorUserId: args.actorUserId,
      action: args.squad === VARSITY ? "promote" : "demote",
      beforeJson: JSON.stringify({ squad: player.squad ?? null }),
      afterJson: JSON.stringify({
        squad: args.squad,
        playerId: args.playerId as string,
      }),
      createdAt: new Date().toISOString(),
    });

    return { squad: args.squad, changed: true };
  },
});

/**
 * Move a player to a different position.
 *
 * Rewrites three things, because a position lives in three places: the player
 * row (what he is), the season's roster assignment (where he is slotted this
 * year) and the depth chart (where he is in the pecking order). Leaving any of
 * them behind is the stale-slot bug this is tested against — a player listed
 * at QB whose depth-chart card still sits under DB.
 *
 * ONLY the season passed in is rewritten. `players.position` is global and a
 * completed season's assignment is a record of where he actually played; a
 * coach who converts a safety to receiver in the offseason has not retroped
 * last year's snaps to receiver, and rewriting them would be falsifying a
 * result. The disagreement between the two is the honest reading.
 */
export const changePlayerPosition = internalMutation({
  args: {
    playerId: v.id("players"),
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    position: v.string(),
    actorUserId: v.string(),
  },
  returns: v.object({
    position: v.string(),
    positionGroup: v.string(),
    changed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const position = args.position.trim().toUpperCase();
    if (derivePositionGroup(position) === null) {
      throw new Error("invalid_position");
    }
    const positionGroup = attributeGroupForPosition(position);

    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("player_not_found");
    if (player.teamId !== args.teamId) throw new Error("player_not_on_team");

    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.rosterLocked === true) throw new Error("season_locked");

    if (player.position === position) {
      return { position, positionGroup, changed: false };
    }

    const previous = { position: player.position, group: player.positionGroup };
    await ctx.db.patch(args.playerId, { position, positionGroup });

    const teamAssignments = await ctx.db
      .query("rosterAssignments")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
      )
      .collect();

    /*
     * He joins the BACK of the new position's depth, not the rank he held at
     * the old one. A converted player has not earned a starting job at a
     * position he has never played, and inheriting rank 1 would silently
     * demote whoever actually held it.
     */
    const nextDepthRank =
      teamAssignments
        .filter(
          (row) =>
            row.status === "active" &&
            row.positionSlot === position &&
            row.playerId !== args.playerId,
        )
        .reduce((max, row) => Math.max(max, row.depthRank), 0) + 1;

    for (const row of teamAssignments) {
      if (row.playerId !== args.playerId) continue;
      await ctx.db.patch(row._id, {
        positionSlot: position,
        depthRank: nextDepthRank,
      });
    }

    const depthEntries = await ctx.db
      .query("depthChartEntries")
      .withIndex("by_team_season", (q) =>
        q.eq("teamId", args.teamId).eq("seasonId", args.seasonId),
      )
      .collect();
    const mine = depthEntries.filter((row) => row.playerId === args.playerId);
    const nextSortOrder =
      depthEntries
        .filter(
          (row) =>
            row.positionSlot === position && row.playerId !== args.playerId,
        )
        .reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;

    const now = new Date().toISOString();
    if (mine.length === 0) {
      /*
       * No depth entry to move. Nothing is created here: a player absent from
       * the depth chart was absent before the change too, and adding him now
       * would make a position change quietly do roster work nobody asked for.
       */
    } else {
      // Keep the first, drop any duplicates rather than leaving him listed at
      // two positions at once.
      await ctx.db.patch(mine[0]._id, {
        positionSlot: position,
        sortOrder: nextSortOrder,
        updatedAt: now,
      });
      for (const extra of mine.slice(1)) {
        await ctx.db.delete(extra._id);
      }
    }

    await ctx.db.insert("rosterAuditLog", {
      leagueId: player.leagueId,
      teamId: args.teamId,
      seasonId: args.seasonId,
      actorUserId: args.actorUserId,
      action: "position_change",
      beforeJson: JSON.stringify({
        position: previous.position,
        positionGroup: previous.group,
      }),
      afterJson: JSON.stringify({
        position,
        positionGroup,
        playerId: args.playerId as string,
      }),
      createdAt: now,
    });

    return { position, positionGroup, changed: true };
  },
});

/*
 * ── Offseason training (B6) ────────────────────────────────────────────────
 *
 * A finite budget, spent on named players in a named direction, applied to the
 * ratings the rollover already wrote for the upcoming season.
 *
 * ## Why allocation and application are two steps
 *
 * Scouting (B3) applies the instant you spend, and that is right for scouting:
 * you are buying information and you should see it. Training is a PLAN. A coach
 * assembling a spring wants to move points between players while he decides,
 * and a mechanic that rewrote his roster on every click would make undo the
 * first thing he asked for. So allocations accumulate against the budget and
 * land together when the offseason leaves the training phase.
 *
 * The rules themselves live in `lib/training.ts`, Convex-free and tested there.
 * This end owns storage, the budget check and the idempotency stamp.
 */

const trainingAllocationValidator = v.object({
  id: v.string(),
  seasonId: v.string(),
  teamId: v.string(),
  playerId: v.string(),
  focus: v.string(),
  points: v.number(),
  appliedAt: v.union(v.string(), v.null()),
  /** Per-attribute gain once applied, JSON-encoded. Null until then. */
  appliedGainJson: v.union(v.string(), v.null()),
  createdAt: v.string(),
});

type TrainingAllocationDoc = Doc<"playerTrainingAllocations">;

function toTrainingAllocationDto(
  row: TrainingAllocationDoc,
): Infer<typeof trainingAllocationValidator> {
  return {
    id: row._id as string,
    seasonId: row.seasonId as string,
    teamId: row.teamId as string,
    playerId: row.playerId as string,
    focus: row.focus,
    points: row.points,
    appliedAt: row.appliedAt ?? null,
    appliedGainJson: row.appliedGainJson ?? null,
    createdAt: row.createdAt,
  };
}

/**
 * One team's training ledger for a season.
 *
 * Scoped to a team rather than the season on purpose. The budget is per team
 * (see `convex/tables/offseason.ts`), so the number the panel needs is this
 * team's spend — returning the league's rows to compute it would leak every
 * other program's spring plan to anyone who opened the hub.
 */
export const listTrainingAllocations = query({
  args: { seasonId: v.id("seasons"), teamId: v.id("teams") },
  returns: v.array(trainingAllocationValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("playerTrainingAllocations")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
      )
      .collect();
    return rows
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toTrainingAllocationDto);
  },
});

/**
 * Commit points to one player.
 *
 * `teamId` is an argument and is checked against the player, for the same
 * reason as `setPlayerSquad` (B5): the Next layer's per-team gate and this
 * check must be about the SAME team, and deriving it here would hide a coach
 * spending on a player who has already left.
 *
 * The budget is read from this team's own rows, so two coaches allocating at
 * the same moment cannot oversell a shared pool — Convex serializes the
 * mutations, and the second one sees the first one's row.
 */
export const allocateTraining = internalMutation({
  args: {
    playerId: v.id("players"),
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    focus: v.string(),
    points: v.number(),
    actorUserId: v.string(),
  },
  returns: v.object({
    allocation: trainingAllocationValidator,
    pointsSpent: v.number(),
    pointsTotal: v.number(),
  }),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("player_not_found");
    if (player.teamId !== args.teamId) throw new Error("player_not_on_team");

    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    if (season.rosterLocked) throw new Error("season_locked");

    const offseason = await ensureOffseason(
      ctx,
      args.seasonId,
      args.actorUserId,
    );

    const existing = await ctx.db
      .query("playerTrainingAllocations")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
      )
      .collect();
    const spent = totalAllocatedPoints(existing);

    const decision = trainingGate({
      focus: args.focus,
      points: args.points,
      spent,
      total: offseason.trainingPointsTotal,
    });
    if (!decision.ok) throw new Error(decision.reason);

    const now = new Date().toISOString();
    const id = await ctx.db.insert("playerTrainingAllocations", {
      leagueId: season.leagueId,
      seasonId: args.seasonId,
      teamId: args.teamId,
      playerId: args.playerId,
      focus: args.focus,
      points: args.points,
      createdAt: now,
      createdBy: args.actorUserId,
    });

    /*
     * The league counter on the offseason row is the audit total across every
     * team, kept in step here so an admin can see how much of the league's
     * spring has been planned. The gate above deliberately does NOT read it —
     * it is a sum of per-team budgets, not a budget itself.
     */
    await ctx.db.patch(offseason._id, {
      trainingPointsSpent: offseason.trainingPointsSpent + args.points,
      updatedAt: now,
      updatedBy: args.actorUserId,
    });

    const row = await ctx.db.get(id);
    if (!row) throw new Error("allocation_not_found");
    return {
      allocation: toTrainingAllocationDto(row),
      pointsSpent: spent + args.points,
      pointsTotal: offseason.trainingPointsTotal,
    };
  },
});

/**
 * Land every unapplied allocation for a season on the players' ratings.
 *
 * Called when the offseason leaves the training phase. Additive rather than a
 * re-derivation of progression: a freshman signed in this same offseason has no
 * prior season to re-derive from, and a mechanic that worked for veterans and
 * silently skipped the class you just recruited would be worse than no
 * mechanic. `appliedAt` is therefore load-bearing, not decorative — it is the
 * only thing standing between a retry and a roster trained twice.
 *
 * Grouped per player so a player with three allocations gets one patch and one
 * consistent `weightedOverall`, rather than three that each recompute from a
 * map the previous one had already moved.
 */
export const applyTrainingAllocations = internalMutation({
  args: { seasonId: v.id("seasons"), actorUserId: v.string() },
  returns: v.object({
    applied: v.number(),
    playersTrained: v.number(),
    pointsPlaced: v.number(),
  }),
  handler: async (ctx, args) => {
    const pending = (
      await ctx.db
        .query("playerTrainingAllocations")
        .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
        .collect()
    ).filter((row) => row.appliedAt === undefined);
    if (pending.length === 0) {
      return { applied: 0, playersTrained: 0, pointsPlaced: 0 };
    }

    const byPlayer = new Map<Id<"players">, TrainingAllocationDoc[]>();
    for (const row of pending) {
      const bucket = byPlayer.get(row.playerId);
      if (bucket) bucket.push(row);
      else byPlayer.set(row.playerId, [row]);
    }

    const now = new Date().toISOString();
    let applied = 0;
    let playersTrained = 0;
    let pointsPlaced = 0;

    for (const [playerId, rows] of byPlayer) {
      const player = await ctx.db.get(playerId);
      /*
       * A player who left between allocation and application. His points are
       * stamped rather than left pending: they were spent, the spring happened
       * somewhere else, and leaving them unapplied would make them land on
       * whoever holds that id next.
       */
      if (!player) {
        for (const row of rows) {
          await ctx.db.patch(row._id, { appliedAt: now });
          applied++;
        }
        continue;
      }

      const ratingPlayerId = player.sourcePlayerId ?? playerId;
      const snapshot = await ctx.db
        .query("playerAttributes")
        .withIndex("by_playerId_seasonId", (q) =>
          q.eq("playerId", ratingPlayerId).eq("seasonId", args.seasonId),
        )
        .first();
      if (!snapshot) {
        // Nothing to train. An unrated player would need ratings invented for
        // him, which is a different decision than the one a coach made here.
        for (const row of rows) {
          await ctx.db.patch(row._id, { appliedAt: now });
          applied++;
        }
        continue;
      }

      const attributes = parseAttributes(snapshot.attributesJson);
      const positionGroup =
        snapshot.positionGroup || attributeGroupForPosition(player.position);
      const developmentRating = await headCoachDevelopmentRatingForTeam(
        ctx,
        rows[0]!.teamId,
      );
      const result = applyTraining({
        attributes,
        positionGroup,
        allocations: rows.map((row) => ({
          focus: row.focus,
          points: row.points,
        })),
        developmentRating,
      });

      if (result.pointsPlaced > 0) {
        /*
         * The overall moves by the DELTA, not by a fresh mean of the map.
         *
         * `weightedOverall` is not always the mean: for a player with real
         * ratings it is a PFF/Madden blend written by `ingestPlayerAttributesBatch`.
         * Recomputing it here would silently replace that blend with an average
         * the first time anyone trained him, and the rating would jump for a
         * reason no coach could connect to the points he spent. Spreading
         * `pointsPlaced` over the map raises its mean by exactly
         * `pointsPlaced / keys`, so applying that same shift moves the stored
         * number without redefining what it means.
         */
        const keys = Object.keys(result.attributes).length;
        const shift = keys > 0 ? result.pointsPlaced / keys : 0;
        const values = Object.values(result.attributes);
        const overall =
          snapshot.weightedOverall === null
            ? values.length > 0
              ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
              : null
            : Math.min(99, Math.round(snapshot.weightedOverall + shift));
        await ctx.db.patch(snapshot._id, {
          attributesJson: JSON.stringify(result.attributes),
          weightedOverall: overall,
        });
        playersTrained++;
        pointsPlaced += result.pointsPlaced;
      }

      for (const row of rows) {
        await ctx.db.patch(row._id, {
          appliedAt: now,
          appliedGainJson: JSON.stringify(result.gains),
        });
        applied++;
      }
    }

    return { applied, playersTrained, pointsPlaced };
  },
});
