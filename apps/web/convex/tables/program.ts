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

    createdAt: v.string(),
    updatedAt: v.string(),
    updatedBy: v.string(),
  })
    /* One indexed read serves a whole season simulation — see `SeasonSimContext`. */
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_teamId", ["seasonId", "teamId"])
    .index("by_teamId", ["teamId"]),
};
