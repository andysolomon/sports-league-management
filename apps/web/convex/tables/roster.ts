import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Season-scoped roster state: the dynasty rollover claim, depth charts, roster
 * assignments and the roster audit trail. Definitions moved verbatim from
 * `schema.ts` (Dynasty Mode F1).
 */
export const rosterTables = {
  // A durable, one-to-one source → target claim lets a rollover retry resume
  // its original upcoming season instead of creating a duplicate.
  seasonRollovers: defineTable({
    leagueId: v.id("leagues"),
    sourceSeasonId: v.id("seasons"),
    targetSeasonId: v.id("seasons"),
    status: v.string(), // "in_progress" | "completed" | "failed"
    stage: v.string(),
    graduatedPlayerIds: v.optional(v.array(v.id("players"))),
    advancedPlayerIds: v.optional(v.array(v.id("players"))),
    summaryJson: v.optional(v.string()),
    stageLeaseStage: v.optional(v.string()),
    stageLeaseOwnerId: v.optional(v.string()),
    stageLeaseExpiresAt: v.optional(v.string()),
    freshmenProgressJson: v.optional(v.string()),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    lastError: v.optional(v.string()),
  })
    .index("by_sourceSeasonId", ["sourceSeasonId"])
    .index("by_targetSeasonId", ["targetSeasonId"])
    .index("by_leagueId", ["leagueId"]),

  depthChartEntries: defineTable({
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    playerId: v.id("players"),
    positionSlot: v.string(),
    sortOrder: v.number(),
    updatedAt: v.string(),
  })
    .index("by_team_season", ["teamId", "seasonId"])
    .index("by_team_season_position", ["teamId", "seasonId", "positionSlot"]),

  rosterAssignments: defineTable({
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    playerId: v.id("players"),
    leagueId: v.id("leagues"),
    depthRank: v.number(),
    positionSlot: v.string(),
    status: v.string(),
    assignedAt: v.string(),
    assignedBy: v.string(),
  })
    .index("by_seasonId_teamId", ["seasonId", "teamId"])
    .index("by_seasonId_teamId_position", [
      "seasonId",
      "teamId",
      "positionSlot",
    ])
    .index("by_playerId", ["playerId"])
    .index("by_leagueId_seasonId", ["leagueId", "seasonId"]),

  rosterAuditLog: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    actorUserId: v.string(),
    action: v.string(),
    beforeJson: v.union(v.string(), v.null()),
    afterJson: v.union(v.string(), v.null()),
    createdAt: v.string(),
  })
    .index("by_leagueId_createdAt", ["leagueId", "createdAt"])
    .index("by_teamId_createdAt", ["teamId", "createdAt"]),
};
