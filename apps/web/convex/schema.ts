import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leagues: defineTable({
    name: v.string(),
    orgId: v.union(v.string(), v.null()),
    isPublic: v.boolean(),
    inviteToken: v.union(v.string(), v.null()),
  })
    .index("by_name", ["name"])
    .index("by_orgId", ["orgId"])
    .index("by_isPublic", ["isPublic"])
    .index("by_inviteToken", ["inviteToken"]),

  divisions: defineTable({
    name: v.string(),
    leagueId: v.id("leagues"),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_leagueId_name", ["leagueId", "name"]),

  teams: defineTable({
    name: v.string(),
    leagueId: v.id("leagues"),
    divisionId: v.union(v.id("divisions"), v.null()),
    city: v.string(),
    stadium: v.string(),
    foundedYear: v.union(v.number(), v.null()),
    location: v.string(),
    logoUrl: v.union(v.string(), v.null()),
    rosterLimit: v.union(v.number(), v.null()),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_divisionId", ["divisionId"])
    .index("by_leagueId_name", ["leagueId", "name"]),

  players: defineTable({
    name: v.string(),
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    position: v.string(),
    positionGroup: v.union(v.string(), v.null()),
    jerseyNumber: v.union(v.number(), v.null()),
    dateOfBirth: v.union(v.string(), v.null()),
    status: v.string(),
    headshotUrl: v.union(v.string(), v.null()),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_teamId", ["teamId"])
    .index("by_teamId_name", ["teamId", "name"]),

  seasons: defineTable({
    name: v.string(),
    leagueId: v.id("leagues"),
    startDate: v.union(v.string(), v.null()),
    endDate: v.union(v.string(), v.null()),
    status: v.string(),
    rosterLocked: v.boolean(),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_leagueId_name", ["leagueId", "name"]),

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

  leagueSubscriptions: defineTable({
    userId: v.string(),
    leagueId: v.id("leagues"),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_leagueId", ["userId", "leagueId"])
    .index("by_leagueId", ["leagueId"]),

  syncConfigs: defineTable({
    key: v.string(),
    syncEnabled: v.boolean(),
    lastSyncReportJson: v.union(v.string(), v.null()),
  }).index("by_key", ["key"]),
});
