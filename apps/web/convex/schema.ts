import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leagues: defineTable({
    name: v.string(),
    orgId: v.union(v.string(), v.null()),
    isPublic: v.boolean(),
    inviteToken: v.union(v.string(), v.null()),
    // Hybrid fork model (WSM-000109): when true, individual teams in this
    // (public template) league can be CLAIMED by a coach's org — the league
    // stays shared/read-only, but a claimed team becomes editable by its
    // owner. Reference leagues (NFL) leave this false/undefined.
    claimable: v.optional(v.boolean()),
    // Org workspace model (WSM-000113/114): a workspace league (orgId set,
    // isPublic false) is a private fork of a reference league. sourceLeagueId
    // points to the reference it was forked from. Reference leagues leave it
    // unset.
    sourceLeagueId: v.optional(v.id("leagues")),
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
    // Team identity (WSM-000134): the team's own name/mascot, distinct from the
    // school name in `name` (e.g. school "Allatoona", teamName "Buccaneers"),
    // plus optional brand colors (hex). All optional; absent = fall back to
    // `name` and a neutral theme.
    teamName: v.optional(v.union(v.string(), v.null())),
    primaryColor: v.optional(v.union(v.string(), v.null())),
    secondaryColor: v.optional(v.union(v.string(), v.null())),
    // Hybrid fork model (WSM-000109): the Clerk org that CLAIMED this team in a
    // claimable league. null/undefined = unclaimed. An admin of this org can
    // edit the team + its roster even though the league itself is shared.
    ownerOrgId: v.optional(v.union(v.string(), v.null())),
    // Org workspace (WSM-000114): a workspace team's link to the reference team
    // it was forked from. Ratings + provenance resolve through it.
    sourceTeamId: v.optional(v.id("teams")),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_divisionId", ["divisionId"])
    .index("by_leagueId_name", ["leagueId", "name"])
    .index("by_ownerOrgId", ["ownerOrgId"]),

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
    // Optional: pre-experienceYears documents validate without backfill.
    experienceYears: v.optional(v.union(v.number(), v.null())),
    // Org workspace (WSM-000114): a workspace player's link to the reference
    // player it was forked from — SPRT/Madden ratings resolve through it so
    // they stay live without duplicating the rating pipeline per org.
    sourcePlayerId: v.optional(v.id("players")),
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
    // À la carte import (WSM-000100): the teams the user chose to import from
    // this league. undefined/empty = "import all" (backward-compatible with
    // pre-feature rows). A display filter on the Teams/Players lists, not an
    // access boundary — the league stays fully viewable (standings, detail).
    teamIds: v.optional(v.array(v.id("teams"))),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_leagueId", ["userId", "leagueId"])
    .index("by_leagueId", ["leagueId"]),

  syncConfigs: defineTable({
    key: v.string(),
    syncEnabled: v.boolean(),
    lastSyncReportJson: v.union(v.string(), v.null()),
  }).index("by_key", ["key"]),

  /*
   * Intra-org capability roles (WSM-000121).
   *
   * Clerk owns membership + the admin bit (org:admin). For org:member users we
   * layer a finer capability role here — "coach" (manage rosters/players) or
   * "viewer" (read-only). Absence of a row means viewer (the least-privilege
   * default), so admins and brand-new members need no row. Orphan rows are
   * harmless: callers always gate on live Clerk membership first, then consult
   * this table only to split a member into coach vs viewer.
   */
  orgMemberRoles: defineTable({
    orgId: v.string(),
    userId: v.string(),
    role: v.string(), // "coach" | "viewer"
  }).index("by_orgId_userId", ["orgId", "userId"]),

  /*
   * Phase 2 — `player_attributes_v1` (Sprint 6B).
   *
   * One row per player per season. Stores raw source payloads
   * (PFF + Madden + admin-uploaded JSON) for transparency, plus
   * a canonical `attributesJson` that downstream code reads.
   * `weightedOverall` is computed at ingest time per the formula in
   * roster-management.md §5.3 — sources with null weight short-circuit.
   */
  playerAttributes: defineTable({
    playerId: v.id("players"),
    seasonId: v.id("seasons"),
    positionGroup: v.string(),
    attributesJson: v.string(),
    pffSourceJson: v.union(v.string(), v.null()),
    maddenSourceJson: v.union(v.string(), v.null()),
    pffWeight: v.number(),
    maddenWeight: v.number(),
    weightedOverall: v.union(v.number(), v.null()),
    ingestedAt: v.string(),
  })
    .index("by_playerId_seasonId", ["playerId", "seasonId"])
    .index("by_seasonId_positionGroup", ["seasonId", "positionGroup"]),

  /*
   * Madden ratings (WSM-000095).
   *
   * One row per player — the current Madden NFL snapshot, matched to our
   * roster by normalized name + team at ingest. Deliberately separate from
   * `playerAttributes` (which is SPRT, per-season): Madden is a single
   * current snapshot shown side-by-side with SPRT, and it never feeds the
   * SPRT career chart. `attributesJson` holds the full Madden attribute map;
   * `overall` is EA's Overall. Portrait/logo are EA CDN URLs from the source.
   */
  maddenRatings: defineTable({
    playerId: v.id("players"),
    overall: v.number(),
    position: v.string(),
    attributesJson: v.string(),
    portraitUrl: v.union(v.string(), v.null()),
    teamLogoUrl: v.union(v.string(), v.null()),
    ingestedAt: v.string(),
  }).index("by_playerId", ["playerId"]),

  /*
   * Phase 3 — `schedules_standings_v1` (Sprint 7).
   *
   * One row per scheduled game. `status` transitions
   * "scheduled" → "final" when a `gameResults` row is recorded.
   * `scheduledAt` + `week` are nullable for TBD entries.
   */
  fixtures: defineTable({
    seasonId: v.id("seasons"),
    homeTeamId: v.id("teams"),
    awayTeamId: v.id("teams"),
    scheduledAt: v.union(v.string(), v.null()),
    week: v.union(v.number(), v.null()),
    venue: v.union(v.string(), v.null()),
    status: v.string(),
    createdAt: v.string(),
    createdBy: v.string(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_week", ["seasonId", "week"])
    .index("by_homeTeamId", ["homeTeamId"])
    .index("by_awayTeamId", ["awayTeamId"]),

  /*
   * One row per played fixture. `playerStatsJson` is reserved for
   * Phase 4 per-player rollups feeding `playerAttributes`; null in v1.
   */
  gameResults: defineTable({
    fixtureId: v.id("fixtures"),
    homeScore: v.number(),
    awayScore: v.number(),
    playerStatsJson: v.union(v.string(), v.null()),
    recordedAt: v.string(),
    recordedBy: v.string(),
  }).index("by_fixtureId", ["fixtureId"]),
});
