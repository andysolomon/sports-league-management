import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Program management (Epic C).
 *
 * ## Why this table exists in A6 rather than C3
 *
 * The roadmap gives `teamSeasonPrograms` to C3 and gives the simulator's
 * consumption of schemes to A6, with A6 shipping second. A6 shipped first, and
 * a scheme the engine can read but nobody can set is a mechanic shipped dark —
 * exactly the failure the sim-activation slice existed to correct.
 *
 * So the table lands here with ONLY the fields A6 consumes. C3 adds prestige,
 * facilities, season goals, job security and the weekly gameplan to this same
 * table; it does not create a second one.
 *
 * Every gameplay field is optional. A team with no row is fully configured — it
 * runs no scheme, which resolves to the identity transform rather than to an
 * average. That is what keeps the table migration-free and keeps the
 * scheme-neutrality invariant true for every league that has set nothing.
 */
export const programTables = {
  teamSeasonPrograms: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),

    /*
     * Scheme identifiers from `src/lib/program/schemes.ts`, stored as strings
     * rather than a union validator.
     *
     * A union would turn adding a scheme to the catalog into a schema
     * migration, and — worse — would make a league that had picked a scheme we
     * later renamed fail to READ. `offenseTendencies` resolves an unknown id to
     * the neutral vector, so a stale value degrades to "no scheme" instead of
     * breaking a season simulation.
     */
    offenseScheme: v.optional(v.string()),
    defenseScheme: v.optional(v.string()),

    /** 0–100, 50 neutral. Overrides the offensive scheme's own tempo. */
    tempo: v.optional(v.number()),
    /** 0–100, 50 neutral. Overrides the defensive scheme's own blitz rate. */
    blitzRate: v.optional(v.number()),
    /**
     * 0–100, 50 neutral. Feeds the fourth-down chart (A3).
     *
     * A coach attribute living on the team for now. C1 introduces `coaches`
     * with its own aggression; the resolver reads the coach first and falls
     * back to this, so a league that set it here keeps what it set.
     */
    aggression: v.optional(v.number()),

    /** Program prestige 0–100. Absent until modelled or season finalize writes it. */
    prestige: v.optional(v.number()),
    /** Facilities tier 1–5. */
    facilitiesTier: v.optional(v.number()),
    /** JSON array of `SeasonGoal` from `lib/goals.ts`. */
    seasonGoalsJson: v.optional(v.string()),
    /** Coach seat heat 0–100. */
    jobSecurity: v.optional(v.number()),
    /** Booster confidence 0–100. */
    boosterConfidence: v.optional(v.number()),

    createdAt: v.string(),
    updatedAt: v.string(),
    updatedBy: v.string(),
  })
    /* One indexed read serves a whole season simulation — see `SeasonSimContext`. */
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_teamId", ["seasonId", "teamId"])
    .index("by_teamId", ["teamId"]),

  /*
   * Coach identity (Dynasty Mode C1).
   *
   * A program is run by people, not anonymous team rows. `userId` and
   * `by_userId` exist from day one so Wave 5 can bind a real operator to a
   * coach without a migration. Until then, `status: "ai"` head coaches are
   * seeded per team.
   *
   * Scheme preferences here are identity — what this coach tends to run — not
   * the season-scoped dial on `teamSeasonPrograms`, which is what the sim
   * reads today.
   */
  coaches: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.union(v.id("teams"), v.null()),
    userId: v.optional(v.string()),
    displayName: v.string(),
    role: v.string(),
    status: v.string(),
    archetype: v.string(),
    offensiveSchemePreference: v.optional(v.string()),
    defensiveSchemePreference: v.optional(v.string()),
    aggression: v.optional(v.number()),
    clockManagement: v.optional(v.number()),
    developmentRating: v.optional(v.number()),
    recruitingRating: v.optional(v.number()),
    gameplanRating: v.optional(v.number()),
    prestige: v.number(),
    skillPoints: v.optional(v.number()),
    unlockedNodesJson: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_teamId", ["teamId"])
    .index("by_teamId_role", ["teamId", "role"])
    .index("by_userId", ["userId"]),

  /*
   * Per-season coach ledger (Dynasty Mode C1).
   *
   * C2 will write these from `completeSeason`; C1 backfills from
   * `seasonTeamRecords` when a head coach is seeded so Career has history
   * without touching the sim.
   */
  coachSeasons: defineTable({
    coachId: v.id("coaches"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    wins: v.number(),
    losses: v.number(),
    ties: v.number(),
    playoffResult: v.optional(v.string()),
    goalsMetJson: v.optional(v.string()),
    prestigeDelta: v.optional(v.number()),
    skillPointsAwarded: v.optional(v.number()),
    finalizedAt: v.optional(v.string()),
  })
    .index("by_coach_season", ["coachId", "seasonId"])
    .index("by_season_team", ["seasonId", "teamId"]),

  /*
   * Weekly gameplan per (fixture, team) — C3.
   *
   * Lives on the fixture surface, not season program rows. A team can run the
   * same scheme all year and still change emphasis week to week.
   */
  fixtureTeamGameplans: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    fixtureId: v.id("fixtures"),
    teamId: v.id("teams"),
    focus: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    updatedBy: v.string(),
  })
    .index("by_fixtureId", ["fixtureId"])
    .index("by_fixtureId_teamId", ["fixtureId", "teamId"])
    .index("by_seasonId", ["seasonId"]),
};
