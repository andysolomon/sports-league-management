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
