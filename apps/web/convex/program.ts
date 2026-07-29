import { v } from "convex/values";
import type { Infer } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";
import {
  COACH_ROLE_HEAD,
  COACH_STATUS_AI,
  generateAiHeadCoachProfile,
} from "./lib/coach";
import { evaluateGoals, generateGoals } from "./lib/goals";
import {
  applySkill,
  coachSkillsStateFromRow,
  serializeUnlockedNodes,
} from "./lib/coachSkills";
import type { Id } from "./_generated/dataModel";

/*
 * Dynasty Mode — program management (Epic C).
 *
 * Home for coaches and staff, program prestige, season goals, job security,
 * team schemes and the coach skill tree. Empty in F1 beyond the readiness probe.
 *
 * ## Rules
 *
 * 1. Every WRITE is an `internalMutation` (WSM-000096); the guard test's
 *    `AllowedPublicProgramReads` backstop fails `tsc` if one leaks.
 * 2. Every function declares a `returns:` validator (WSM-000166).
 * 3. Season finalization hooks (goal evaluation, prestige, coach-season
 *    rollup) read ONLY the persisted `seasonTeamRecords` and
 *    `playerSeasonAggregates` from Epic F — never `playerGameStats` or
 *    `fixtures` directly. That restriction is what stops Epic C from
 *    reintroducing the N+1 read pattern F2/F3 exist to remove.
 * 4. `coaches.userId` and its `by_userId` index exist from the first slice, so
 *    a coach can later be bound to a real user without a migration.
 */

/** Module readiness probe — see `lib/moduleStatus.ts` for why this exists. */
export const moduleStatus = query({
  args: {},
  returns: moduleStatusValidator,
  handler: async () => ({
    module: DYNASTY_MODULES.program,
    epic: "C",
    ready: true,
  }),
});

/*
 * ── Team programs (A6, extended by C3) ──────────────────────────────────────
 */

const teamProgramValidator = v.object({
  id: v.string(),
  leagueId: v.string(),
  seasonId: v.string(),
  teamId: v.union(v.string(), v.null()),
  offenseScheme: v.union(v.string(), v.null()),
  defenseScheme: v.union(v.string(), v.null()),
  tempo: v.union(v.number(), v.null()),
  blitzRate: v.union(v.number(), v.null()),
  aggression: v.union(v.number(), v.null()),
  prestige: v.union(v.number(), v.null()),
  facilitiesTier: v.union(v.number(), v.null()),
  seasonGoalsJson: v.union(v.string(), v.null()),
  jobSecurity: v.union(v.number(), v.null()),
  boosterConfidence: v.union(v.number(), v.null()),
  updatedAt: v.string(),
});

/**
 * `Infer` pins the DTO to its validator (WSM-000166).
 *
 * Convex validates RETURNS strictly, so a mapper that drifts from the validator
 * is a data-dependent 500 in production rather than a compile error — unless
 * the mapper's return type is derived from the validator, which is what this
 * does.
 */
type TeamProgramDto = Infer<typeof teamProgramValidator>;

function toTeamProgramDto(row: {
  _id: string;
  leagueId: string;
  seasonId: string;
  teamId: string;
  offenseScheme?: string;
  defenseScheme?: string;
  tempo?: number;
  blitzRate?: number;
  aggression?: number;
  prestige?: number;
  facilitiesTier?: number;
  seasonGoalsJson?: string;
  jobSecurity?: number;
  boosterConfidence?: number;
  updatedAt: string;
}): TeamProgramDto {
  return {
    id: row._id,
    leagueId: row.leagueId,
    seasonId: row.seasonId,
    teamId: row.teamId,
    /*
     * `null` for an unset field, never a default.
     *
     * "This team has not chosen an offense" and "this team runs the balanced
     * offense" are different claims, and only the second one is a decision
     * somebody made. The engine treats both as neutral; the UI must not show
     * an unset team as having picked something.
     */
    offenseScheme: row.offenseScheme ?? null,
    defenseScheme: row.defenseScheme ?? null,
    tempo: row.tempo ?? null,
    blitzRate: row.blitzRate ?? null,
    aggression: row.aggression ?? null,
    prestige: row.prestige ?? null,
    facilitiesTier: row.facilitiesTier ?? null,
    seasonGoalsJson: row.seasonGoalsJson ?? null,
    jobSecurity: row.jobSecurity ?? null,
    boosterConfidence: row.boosterConfidence ?? null,
    updatedAt: row.updatedAt,
  };
}

/**
 * Every team's program for a season, in one indexed read.
 *
 * Read once per simulation RUN, not per fixture — a season sim plays every
 * game in a loop and a per-fixture read here would be the N+1 shape Epic F
 * exists to remove.
 */
export const listTeamPrograms = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(teamProgramValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("teamSeasonPrograms")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();
    return rows.map(toTeamProgramDto);
  },
});

export const getTeamProgram = query({
  args: { seasonId: v.id("seasons"), teamId: v.id("teams") },
  returns: v.union(teamProgramValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("teamSeasonPrograms")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
      )
      .unique();
    return row ? toTeamProgramDto(row) : null;
  },
});

/** 0–100 dials are clamped rather than rejected — settings never break a sim. */
function clampDial(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Set what a team runs.
 *
 * `internalMutation` (WSM-000096) — authorization lives in the server action,
 * which resolves the actor's role FOR THIS TEAM rather than asking whether they
 * are an org admin. That is deliberate: in solo mode the commissioner passes
 * every team's id, and in the multi-coach wave the identical mutation serves a
 * coach scoped to one team, with no rewrite.
 *
 * Idempotent upsert keyed on (season, team): a team has exactly one program per
 * season, and setting it twice must correct the row rather than create a second
 * one the simulator would have to choose between.
 */
export const setTeamProgram = internalMutation({
  args: {
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    actorUserId: v.string(),
    offenseScheme: v.optional(v.string()),
    defenseScheme: v.optional(v.string()),
    tempo: v.optional(v.number()),
    blitzRate: v.optional(v.number()),
    aggression: v.optional(v.number()),
  },
  returns: teamProgramValidator,
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("season_not_found");
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("team_not_found");
    if (team.leagueId !== season.leagueId) throw new Error("team_not_in_league");

    const now = new Date().toISOString();
    const patch = {
      offenseScheme: args.offenseScheme,
      defenseScheme: args.defenseScheme,
      tempo: clampDial(args.tempo),
      blitzRate: clampDial(args.blitzRate),
      aggression: clampDial(args.aggression),
      updatedAt: now,
      updatedBy: args.actorUserId,
    };

    const existing = await ctx.db
      .query("teamSeasonPrograms")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      const updated = await ctx.db.get(existing._id);
      if (!updated) throw new Error("program_not_found");
      return toTeamProgramDto(updated);
    }

    const id = await ctx.db.insert("teamSeasonPrograms", {
      leagueId: season.leagueId,
      seasonId: args.seasonId,
      teamId: args.teamId,
      createdAt: now,
      ...patch,
    });
    const created = await ctx.db.get(id);
    if (!created) throw new Error("program_not_found");
    return toTeamProgramDto(created);
  },
});

/*
 * ── Weekly gameplans (C3) ───────────────────────────────────────────────────
 */

const fixtureGameplanValidator = v.object({
  id: v.string(),
  leagueId: v.string(),
  seasonId: v.string(),
  fixtureId: v.string(),
  teamId: v.string(),
  focus: v.union(v.string(), v.null()),
  updatedAt: v.string(),
});

type FixtureGameplanDto = Infer<typeof fixtureGameplanValidator>;

function toFixtureGameplanDto(row: {
  _id: string;
  leagueId: string;
  seasonId: string;
  fixtureId: string;
  teamId: string;
  focus?: string;
  updatedAt: string;
}): FixtureGameplanDto {
  return {
    id: row._id,
    leagueId: row.leagueId,
    seasonId: row.seasonId,
    fixtureId: row.fixtureId,
    teamId: row.teamId,
    focus: row.focus ?? null,
    updatedAt: row.updatedAt,
  };
}

export const listFixtureGameplans = query({
  args: { fixtureId: v.id("fixtures") },
  returns: v.array(fixtureGameplanValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("fixtureTeamGameplans")
      .withIndex("by_fixtureId", (q) => q.eq("fixtureId", args.fixtureId))
      .collect();
    return rows.map(toFixtureGameplanDto);
  },
});

export const listGameplansBySeason = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(fixtureGameplanValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("fixtureTeamGameplans")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();
    return rows.map(toFixtureGameplanDto);
  },
});

export const setFixtureGameplan = internalMutation({
  args: {
    fixtureId: v.id("fixtures"),
    teamId: v.id("teams"),
    actorUserId: v.string(),
    focus: v.optional(v.string()),
  },
  returns: fixtureGameplanValidator,
  handler: async (ctx, args) => {
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("fixture_not_found");
    if (
      fixture.homeTeamId !== args.teamId &&
      fixture.awayTeamId !== args.teamId
    ) {
      throw new Error("team_not_in_fixture");
    }
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("team_not_found");
    const season = await ctx.db.get(fixture.seasonId);
    if (!season) throw new Error("season_not_found");
    if (team.leagueId !== season.leagueId) throw new Error("team_not_in_league");

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("fixtureTeamGameplans")
      .withIndex("by_fixtureId_teamId", (q) =>
        q.eq("fixtureId", args.fixtureId).eq("teamId", args.teamId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        focus: args.focus,
        updatedAt: now,
        updatedBy: args.actorUserId,
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) throw new Error("gameplan_not_found");
      return toFixtureGameplanDto(updated);
    }

    const id = await ctx.db.insert("fixtureTeamGameplans", {
      leagueId: season.leagueId,
      seasonId: fixture.seasonId,
      fixtureId: args.fixtureId,
      teamId: args.teamId,
      focus: args.focus,
      createdAt: now,
      updatedAt: now,
      updatedBy: args.actorUserId,
    });
    const created = await ctx.db.get(id);
    if (!created) throw new Error("gameplan_not_found");
    return toFixtureGameplanDto(created);
  },
});

/*
 * ── Coaches (C1) ───────────────────────────────────────────────────────────
 */

const coachDtoValidator = v.object({
  id: v.string(),
  leagueId: v.string(),
  teamId: v.union(v.string(), v.null()),
  userId: v.union(v.string(), v.null()),
  displayName: v.string(),
  role: v.string(),
  status: v.string(),
  archetype: v.string(),
  offensiveSchemePreference: v.union(v.string(), v.null()),
  defensiveSchemePreference: v.union(v.string(), v.null()),
  aggression: v.union(v.number(), v.null()),
  clockManagement: v.union(v.number(), v.null()),
  developmentRating: v.union(v.number(), v.null()),
  recruitingRating: v.union(v.number(), v.null()),
  gameplanRating: v.union(v.number(), v.null()),
  prestige: v.number(),
  skillPoints: v.union(v.number(), v.null()),
  unlockedNodesJson: v.union(v.string(), v.null()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

type CoachDto = Infer<typeof coachDtoValidator>;

function toCoachDto(row: {
  _id: string;
  leagueId: string;
  teamId: string | null;
  userId?: string;
  displayName: string;
  role: string;
  status: string;
  archetype: string;
  offensiveSchemePreference?: string;
  defensiveSchemePreference?: string;
  aggression?: number;
  clockManagement?: number;
  developmentRating?: number;
  recruitingRating?: number;
  gameplanRating?: number;
  prestige: number;
  skillPoints?: number;
  unlockedNodesJson?: string;
  createdAt: string;
  updatedAt: string;
}): CoachDto {
  return {
    id: row._id,
    leagueId: row.leagueId,
    teamId: row.teamId ?? null,
    userId: row.userId ?? null,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    archetype: row.archetype,
    offensiveSchemePreference: row.offensiveSchemePreference ?? null,
    defensiveSchemePreference: row.defensiveSchemePreference ?? null,
    aggression: row.aggression ?? null,
    clockManagement: row.clockManagement ?? null,
    developmentRating: row.developmentRating ?? null,
    recruitingRating: row.recruitingRating ?? null,
    gameplanRating: row.gameplanRating ?? null,
    prestige: row.prestige,
    skillPoints: row.skillPoints ?? null,
    unlockedNodesJson: row.unlockedNodesJson ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const coachSeasonDtoValidator = v.object({
  id: v.string(),
  coachId: v.string(),
  seasonId: v.string(),
  teamId: v.union(v.string(), v.null()),
  wins: v.number(),
  losses: v.number(),
  ties: v.number(),
  playoffResult: v.union(v.string(), v.null()),
  goalsMetJson: v.union(v.string(), v.null()),
  prestigeDelta: v.union(v.number(), v.null()),
  skillPointsAwarded: v.union(v.number(), v.null()),
  finalizedAt: v.union(v.string(), v.null()),
});

type CoachSeasonDto = Infer<typeof coachSeasonDtoValidator>;

function toCoachSeasonDto(row: {
  _id: string;
  coachId: string;
  seasonId: string;
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  playoffResult?: string;
  goalsMetJson?: string;
  prestigeDelta?: number;
  skillPointsAwarded?: number;
  finalizedAt?: string;
}): CoachSeasonDto {
  return {
    id: row._id,
    coachId: row.coachId,
    seasonId: row.seasonId,
    teamId: row.teamId,
    wins: row.wins,
    losses: row.losses,
    ties: row.ties,
    playoffResult: row.playoffResult ?? null,
    goalsMetJson: row.goalsMetJson ?? null,
    prestigeDelta: row.prestigeDelta ?? null,
    skillPointsAwarded: row.skillPointsAwarded ?? null,
    finalizedAt: row.finalizedAt ?? null,
  };
}

export const getCoach = query({
  args: { coachId: v.id("coaches") },
  returns: v.union(coachDtoValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.coachId);
    return row ? toCoachDto(row) : null;
  },
});

export const listCoachesByTeam = query({
  args: { teamId: v.id("teams") },
  returns: v.array(coachDtoValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("coaches")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .collect();
    return rows.map(toCoachDto);
  },
});

export const listCoachesByLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(coachDtoValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("coaches")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();
    return rows.map(toCoachDto);
  },
});

export const listCoachSeasons = query({
  args: { coachId: v.id("coaches") },
  returns: v.array(coachSeasonDtoValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("coachSeasons")
      .withIndex("by_coach_season", (q) => q.eq("coachId", args.coachId))
      .collect();
    return rows.map(toCoachSeasonDto);
  },
});

const evaluatedGoalValidator = v.object({
  id: v.string(),
  metric: v.string(),
  label: v.string(),
  target: v.number(),
  status: v.union(
    v.literal("met"),
    v.literal("missed"),
    v.literal("partial"),
  ),
  actual: v.number(),
});

type EvaluatedGoalDto = Infer<typeof evaluatedGoalValidator>;

export const getSeasonGoalProgress = query({
  args: {
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
  },
  returns: v.array(evaluatedGoalValidator),
  handler: async (ctx, args): Promise<EvaluatedGoalDto[]> => {
    const program = await ctx.db
      .query("teamSeasonPrograms")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
      )
      .unique();

    const goals = program?.seasonGoalsJson
      ? (JSON.parse(program.seasonGoalsJson) as ReturnType<typeof generateGoals>)
      : generateGoals(args.teamId as string, args.seasonId as string);

    const record = await ctx.db
      .query("seasonTeamRecords")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", args.seasonId).eq("teamId", args.teamId),
      )
      .unique();

    const recordInput = record
      ? {
          wins: record.wins,
          losses: record.losses,
          ties: record.ties,
          pointsFor: record.pointsFor,
          pointsAgainst: record.pointsAgainst,
        }
      : {
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
        };

    const aggregates = await ctx.db
      .query("playerSeasonAggregates")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", args.seasonId))
      .collect();

    const teamAggregates = aggregates
      .filter((row) => row.teamId === args.teamId)
      .map((row) => ({ totalsJson: row.totalsJson }));

    return evaluateGoals(goals, recordInput, teamAggregates);
  },
});

async function backfillCoachSeasonsForTeam(
  ctx: { db: any },
  coachId: Id<"coaches">,
  teamId: Id<"teams">,
): Promise<number> {
  const records = await ctx.db
    .query("seasonTeamRecords")
    .withIndex("by_teamId", (q: any) => q.eq("teamId", teamId))
    .collect();

  let written = 0;
  const now = new Date().toISOString();

  for (const record of records) {
    const existing = await ctx.db
      .query("coachSeasons")
      .withIndex("by_coach_season", (q: any) =>
        q.eq("coachId", coachId).eq("seasonId", record.seasonId),
      )
      .unique();
    if (existing) continue;

    await ctx.db.insert("coachSeasons", {
      coachId,
      seasonId: record.seasonId,
      teamId,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      finalizedAt: now,
    });
    written += 1;
  }
  return written;
}

/**
 * Seed an AI head coach for every team in a league that lacks one.
 *
 * Idempotent: a second run must not change the coach count. Coach-season rows
 * are backfilled from `seasonTeamRecords` only when a coach is first created.
 */
export const seedAiHeadCoachesForLeague = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.object({
    coachesCreated: v.number(),
    coachSeasonsCreated: v.number(),
    teamsScanned: v.number(),
  }),
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .collect();

    let coachesCreated = 0;
    let coachSeasonsCreated = 0;
    const now = new Date().toISOString();

    for (const team of teams) {
      const existingHead = await ctx.db
        .query("coaches")
        .withIndex("by_teamId_role", (q) =>
          q.eq("teamId", team._id).eq("role", COACH_ROLE_HEAD),
        )
        .unique();

      if (existingHead) continue;

      const profile = generateAiHeadCoachProfile(team._id as string);
      const coachId = await ctx.db.insert("coaches", {
        leagueId: args.leagueId,
        teamId: team._id,
        displayName: profile.displayName,
        role: COACH_ROLE_HEAD,
        status: COACH_STATUS_AI,
        archetype: profile.archetype,
        offensiveSchemePreference: profile.offensiveSchemePreference ?? undefined,
        defensiveSchemePreference: profile.defensiveSchemePreference ?? undefined,
        aggression: profile.aggression,
        clockManagement: profile.clockManagement,
        developmentRating: profile.developmentRating,
        recruitingRating: profile.recruitingRating,
        gameplanRating: profile.gameplanRating,
        prestige: profile.prestige,
        skillPoints: 0,
        createdAt: now,
        updatedAt: now,
      });
      coachesCreated += 1;
      coachSeasonsCreated += await backfillCoachSeasonsForTeam(
        ctx,
        coachId,
        team._id,
      );
    }

    return {
      coachesCreated,
      coachSeasonsCreated,
      teamsScanned: teams.length,
    };
  },
});

export const spendCoachSkillPoints = internalMutation({
  args: {
    coachId: v.id("coaches"),
    teamId: v.id("teams"),
    nodeId: v.string(),
    actorUserId: v.string(),
  },
  returns: coachDtoValidator,
  handler: async (ctx, args) => {
    const coach = await ctx.db.get(args.coachId);
    if (!coach) throw new Error("coach_not_found");
    if (coach.teamId !== args.teamId) throw new Error("coach_not_on_team");

    const state = coachSkillsStateFromRow(coach);
    const result = applySkill(state, args.nodeId);
    if (!result.ok) throw new Error(result.reason);

    const now = new Date().toISOString();
    const patch: {
      skillPoints: number;
      unlockedNodesJson: string;
      updatedAt: string;
      developmentRating?: number;
      recruitingRating?: number;
      gameplanRating?: number;
    } = {
      skillPoints: result.state.skillPoints,
      unlockedNodesJson: serializeUnlockedNodes(result.state.unlockedNodeIds),
      updatedAt: now,
    };
    if (result.ratings.developmentRating !== null) {
      patch.developmentRating = result.ratings.developmentRating;
    }
    if (result.ratings.recruitingRating !== null) {
      patch.recruitingRating = result.ratings.recruitingRating;
    }
    if (result.ratings.gameplanRating !== null) {
      patch.gameplanRating = result.ratings.gameplanRating;
    }

    await ctx.db.patch(args.coachId, patch);
    const updated = await ctx.db.get(args.coachId);
    if (!updated) throw new Error("coach_not_found");
    return toCoachDto(updated);
  },
});
