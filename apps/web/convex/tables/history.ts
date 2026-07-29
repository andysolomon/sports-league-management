import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Cross-season Dynasty Mode history (Epic D).
 *
 * Unlike competition caches, these rows belong to a League rather than a
 * Season: a career and a record book only become meaningful across seasons.
 */
export const historyTables = {
  playerCareerTotals: defineTable({
    leagueId: v.id("leagues"),
    playerId: v.id("players"),
    /** Sum of every finalized per-season aggregate for this player. */
    totalsJson: v.string(),
    /**
     * JSON `{ [seasonId]: totals }`. Replacing one season's contribution before
     * re-summing is what makes season finalization retry-safe.
     */
    seasonTotalsJson: v.string(),
    updatedAt: v.string(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_leagueId", ["leagueId"]),

  programRecords: defineTable({
    leagueId: v.id("leagues"),
    /**
     * Absent for the league-wide book; present for one Team's book. League and
     * Team rows are intentionally separate because their ranks differ.
     */
    teamId: v.optional(v.id("teams")),
    category: v.string(),
    span: v.string(),
    rank: v.number(),
    value: v.number(),
    playerId: v.optional(v.id("players")),
    /** Team whose player/performance produced the entry (also present on league rows). */
    holderTeamId: v.id("teams"),
    seasonId: v.id("seasons"),
    /** Deterministic identity used to de-duplicate a retried finalization. */
    stableKey: v.string(),
    updatedAt: v.string(),
  })
    .index("by_leagueId_category_rank", ["leagueId", "category", "rank"])
    .index("by_teamId_category_rank", ["teamId", "category", "rank"]),
};
