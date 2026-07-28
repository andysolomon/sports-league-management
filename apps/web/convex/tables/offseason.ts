import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Offseason player movement. Today: the snake draft shipped in WSM-000233.
 * Later Dynasty Mode slices add the persisted offseason phase machine,
 * recruit prospects, transfers and training allocations alongside these.
 * Definitions moved verbatim from `schema.ts` (Dynasty Mode F1).
 */
export const offseasonTables = {
  /*
   * Persisted offseason phase machine (Dynasty Mode B1).
   *
   * One row per target season. The phase used to be DERIVED from draft status
   * in the stepper, which made it unresumable, ungateable and invisible to any
   * audit — and would have had to be rewritten once phases outnumbered the
   * draft.
   *
   * `seasonRollovers` still owns the automatic, lease-protected mechanical
   * stages. This table owns the human-paced ones. The two are separate because
   * a 60-second lease is coherent for a stage that runs in one server action
   * and incoherent for a phase an admin sits in for three days.
   *
   * `completedPhases` is a SET, not a high-water mark, so inserting a phase
   * into the middle of the machine later never forces a migration.
   */
  offseasons: defineTable({
    leagueId: v.id("leagues"),
    /** The UPCOMING season being prepared, not the one that just finished. */
    seasonId: v.id("seasons"),
    phase: v.string(),
    completedPhases: v.array(v.string()),
    /*
     * Budgets are SNAPSHOT at open, alongside `configJson`. An admin who
     * raises `scoutingPointsPerOffseason` halfway through must not retroactively
     * refund an offseason that has already been half spent under the old value.
     * B3 and B6 are the consumers; nothing spends them yet.
     */
    scoutingPointsTotal: v.number(),
    scoutingPointsSpent: v.number(),
    trainingPointsTotal: v.number(),
    trainingPointsSpent: v.number(),
    /** `DynastyConfig` as of open — see the budget note above. */
    configJson: v.string(),
    /*
     * Advance lease. Short-lived and held only across an advance, never across
     * phase occupancy. B2+ phases do real work between claim and commit; today
     * it exists so a second admin clicking Advance loses cleanly rather than
     * double-running that work.
     */
    leasePhase: v.optional(v.string()),
    leaseOwnerId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.string()),
    lastError: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    updatedBy: v.string(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_leagueId", ["leagueId"]),

  /*
   * Offseason snake draft (WSM-000233). One draft per target season; order is
   * reverse final standings. Writes are internalMutation only.
   */
  drafts: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    type: v.string(), // "snake"
    rounds: v.number(),
    order: v.array(v.id("teams")),
    status: v.string(), // "pending" | "active" | "complete"
    currentPick: v.number(),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_seasonId", ["seasonId"]),

  /*
   * Append-only draft pick log (WSM-000233). pickNumber is global 1-based slot.
   */
  draftPicks: defineTable({
    draftId: v.id("drafts"),
    round: v.number(),
    pickNumber: v.number(),
    teamId: v.id("teams"),
    playerId: v.id("players"),
    madeAt: v.number(),
  })
    .index("by_draftId", ["draftId"])
    .index("by_draftId_pickNumber", ["draftId", "pickNumber"]),
};
