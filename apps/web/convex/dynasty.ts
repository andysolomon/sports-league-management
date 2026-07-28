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
