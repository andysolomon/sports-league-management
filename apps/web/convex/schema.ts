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

  /*
   * Hierarchy level above divisions (WSM-000133). A reference league can group
   * its divisions under conferences (e.g. NFL's AFC/NFC). Optional: leagues with
   * a flat division list simply have no conference rows. Mirrors `divisions`
   * (leagueId + name), plus `sourceConferenceId` so a workspace fork can point
   * back at the reference conference it mirrored.
   */
  conferences: defineTable({
    name: v.string(),
    leagueId: v.id("leagues"),
    sourceConferenceId: v.optional(v.id("conferences")),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_leagueId_name", ["leagueId", "name"]),

  divisions: defineTable({
    name: v.string(),
    leagueId: v.id("leagues"),
    // Optional parent conference (WSM-000133). Absent = the division sits
    // directly under the league (flat hierarchy, backward-compatible).
    conferenceId: v.optional(v.id("conferences")),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_leagueId_name", ["leagueId", "name"])
    .index("by_conferenceId", ["conferenceId"]),

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
    // Jersey policy (WSM-000125): when false, the player create/update mutations
    // block a jersey number that's already on another active player. When true
    // or undefined, duplicates are allowed (the historical default) — the UI
    // still surfaces an inline duplicate alert.
    allowDuplicateJerseys: v.optional(v.boolean()),
    // MaxPreps export (WSM-000112): the team's own 32-char Stat Supplier ID,
    // entered by the coach (account-bound to their MaxPreps account). Used as
    // line 1 of the export file; absent = fall back to env / placeholder.
    maxprepsSupplierId: v.optional(v.union(v.string(), v.null())),
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
    // HS fields (optional so pre-existing documents validate without backfill).
    // grade: 9–12; squad: "Varsity" | "JV" | "Freshman".
    grade: v.optional(v.union(v.number(), v.null())),
    squad: v.optional(v.union(v.string(), v.null())),
    // Free-text player hometown, e.g. "Acworth, GA" (WSM-000174).
    hometown: v.optional(v.union(v.string(), v.null())),
    // Org workspace (WSM-000114): a workspace player's link to the reference
    // player it was forked from — SPRT/Madden ratings resolve through it so
    // they stay live without duplicating the rating pipeline per org.
    sourcePlayerId: v.optional(v.id("players")),
    // WSM-000173: marks players created by the synthetic-roster generator, so
    // the "clear synthetic" action only ever deletes generated test players,
    // never real entries. Absent/false on all real players.
    synthetic: v.optional(v.boolean()),
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
    // Playoff configuration set at season setup (WSM-000184). Optional so legacy
    // seasons default sensibly (8 teams, single-elim, no division auto-qualify).
    playoffTeams: v.optional(v.number()), // 0 = no playoffs; else 4 | 8 | 16
    playoffFormat: v.optional(v.string()), // "single" (double = future)
    divisionWinnersQualify: v.optional(v.boolean()),
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
    // "regular" (default when absent) | "playoff" (WSM-000164). Playoff fixtures
    // are spawned by the bracket and excluded from standings computation.
    stage: v.optional(v.string()),
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

  /*
   * One live stream per fixture (WSM-000144, streaming epic #225). Two
   * providers (WSM-000180): "mux" (RTMP ingest, paid) keeps the server-side
   * live-stream id + public HLS playback id; "youtube" (free, paste-a-link)
   * keeps only the public YouTube video id. The Mux stream KEY is never stored.
   * Public reads project to status / playback ids / vodAssetId only; the Mux
   * live-stream id never transits a public query (see getStreamByFixture).
   */
  gameStreams: defineTable({
    fixtureId: v.id("fixtures"),
    provider: v.optional(v.string()), // "mux" | "youtube" (legacy rows = mux)
    muxLiveStreamId: v.optional(v.string()), // mux: server-side; never public
    muxPlaybackId: v.optional(v.string()), // mux: public HLS id
    youtubeVideoId: v.optional(v.union(v.string(), v.null())), // youtube: public
    status: v.string(), // "idle" | "active" | "ended"
    vodAssetId: v.union(v.string(), v.null()),
    startedBy: v.string(),
    startedAt: v.string(),
    endedAt: v.union(v.string(), v.null()),
    maxDurationMinutes: v.number(),
  })
    .index("by_fixtureId", ["fixtureId"])
    .index("by_status", ["status"])
    // Mux webhooks identify the stream by its Mux live-stream id, not fixtureId.
    .index("by_muxLiveStreamId", ["muxLiveStreamId"]),

  /*
   * Stat-keeping keystone (WSM-000112). One row per player per game — the
   * player's box-score line, stored as typed JSON (`statsJson`, validated at the
   * edge like playerAttributes). Supersedes the reserved gameResults.player-
   * StatsJson hook for queryability. Season totals = aggregation over a player's
   * rows; also feeds SPRT at the HS level.
   */
  playerGameStats: defineTable({
    fixtureId: v.id("fixtures"),
    playerId: v.id("players"),
    teamId: v.id("teams"),
    seasonId: v.id("seasons"),
    statsJson: v.string(),
    enteredBy: v.string(),
    updatedAt: v.string(),
  })
    .index("by_fixtureId", ["fixtureId"]) // a game's entered lines (entry/review)
    .index("by_fixtureId_playerId", ["fixtureId", "playerId"]) // upsert key
    .index("by_playerId_seasonId", ["playerId", "seasonId"]) // season totals
    .index("by_teamId_seasonId", ["teamId", "seasonId"]) // team season view
    .index("by_seasonId", ["seasonId"]), // whole-season cohort (SPRT ratings)

  /*
   * Live game-state (WSM-000152, keystone v3). One row per in-progress fixture:
   * the running scoreboard an operator drives. Public reads project to
   * score/period/clock/status only (getLiveGameState) — the seam the streaming
   * live-score overlay (#302) consumes. On "final", the score is written to
   * gameResults (standings) via the shared final-result helper.
   */
  liveGameState: defineTable({
    fixtureId: v.id("fixtures"),
    homeScore: v.number(),
    awayScore: v.number(),
    period: v.number(), // 1..4; OT = 5+
    clock: v.union(v.string(), v.null()), // display string e.g. "7:32"; null if unused
    status: v.string(), // "in_progress" | "halftime" | "final"
    startedBy: v.string(),
    startedAt: v.string(),
    updatedAt: v.string(),
  }).index("by_fixtureId", ["fixtureId"]),

  /*
   * Single-elimination playoffs (WSM-000164). One bracket per season; sizes
   * 4/8/16 (powers of two, no byes). Seeds are snapshotted from standings at
   * generation time onto the matchups.
   */
  playoffBrackets: defineTable({
    seasonId: v.id("seasons"),
    leagueId: v.id("leagues"),
    size: v.number(), // 4 | 8 | 16
    rounds: v.number(), // log2(size)
    createdAt: v.string(),
    createdBy: v.string(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_leagueId", ["leagueId"]),

  /*
   * One node of the bracket tree. round 1 = first round … round = `rounds` is
   * the final. `slot` is the 0-based position within the round. Team/seed ids
   * are null until both feeders resolve. `nextMatchupId`/`nextSlot` point at the
   * parent node the winner advances into (null for the final). `fixtureId` is
   * set once both teams are known and a playable fixture is spawned.
   */
  playoffMatchups: defineTable({
    bracketId: v.id("playoffBrackets"),
    seasonId: v.id("seasons"),
    round: v.number(),
    slot: v.number(),
    homeSeed: v.union(v.number(), v.null()),
    awaySeed: v.union(v.number(), v.null()),
    homeTeamId: v.union(v.id("teams"), v.null()),
    awayTeamId: v.union(v.id("teams"), v.null()),
    // Self-referential id stored as a string: v.id("playoffMatchups") here would
    // make DataModelFromSchemaDefinition circular and silently drop this table's
    // indexes. Cast back to Id<"playoffMatchups"> at the (few) use sites.
    nextMatchupId: v.union(v.string(), v.null()),
    nextSlot: v.union(v.string(), v.null()), // "home" | "away" | null
    winnerTeamId: v.union(v.id("teams"), v.null()),
    fixtureId: v.union(v.id("fixtures"), v.null()),
  })
    .index("by_bracketId", ["bracketId"])
    .index("by_seasonId", ["seasonId"]),
});
