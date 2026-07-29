import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Cross-season Dynasty Mode history (Epic D).
 *
 * Unlike competition caches, these rows belong to a League rather than a
 * Season: a career and a record book only become meaningful across seasons.
 */
export const historyTables = {
  seasonRecaps: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    /** JSON `StorylineBlock[]` from `lib/recap.ts`, in display order. */
    storylineBlocksJson: v.string(),
    generatedAt: v.string(),
    updatedAt: v.string(),
  }).index("by_seasonId", ["seasonId"]),

  weeklyPolls: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    week: v.number(),
    /**
     * JSON `PowerRanking[]`: teamId, rank, previousRank, points, record and
     * trend. Keeping the slate atomic prevents readers seeing half a poll.
     */
    rankingsJson: v.string(),
    publishedAt: v.string(),
  })
    .index("by_seasonId_week", ["seasonId", "week"])
    .index("by_seasonId", ["seasonId"]),

  awards: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    type: v.string(),
    tier: v.string(),
    playerId: v.union(v.id("players"), v.null()),
    coachId: v.union(v.id("coaches"), v.null()),
    teamId: v.id("teams"),
    divisionId: v.union(v.id("divisions"), v.null()),
    positionGroup: v.union(v.string(), v.null()),
    /** Exact output of `lib/awards.ts`; never a rounded display value. */
    scoreValue: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_type", ["seasonId", "type"])
    .index("by_playerId", ["playerId"])
    .index("by_coachId", ["coachId"]),

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
    /** D5 metadata, optional for career rows materialized before HoF shipped. */
    peakOverall: v.optional(v.number()),
    championshipSeasonIds: v.optional(v.array(v.id("seasons"))),
    updatedAt: v.string(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_leagueId", ["leagueId"]),

  hallOfFame: defineTable({
    leagueId: v.id("leagues"),
    /** Exactly one recipient reference is non-null on every induction row. */
    playerId: v.union(v.id("players"), v.null()),
    coachId: v.union(v.id("coaches"), v.null()),
    inductedSeasonId: v.id("seasons"),
    classLabel: v.string(),
    citation: v.string(),
    /** Exact output of `lib/hallOfFame.ts`, retained for explainability. */
    score: v.number(),
    inductedAt: v.string(),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_inductedSeasonId", ["inductedSeasonId"])
    .index("by_playerId", ["playerId"])
    .index("by_coachId", ["coachId"]),

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
