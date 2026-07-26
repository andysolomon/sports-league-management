import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Everything that happens on the field: fixtures, results, play-by-play logs,
 * per-player box scores, live game state and playoff brackets. Definitions
 * moved verbatim from `schema.ts` (Dynasty Mode F1).
 */
export const competitionTables = {
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
   * Play-by-play game log (Slice B). One row per simulated fixture — the full
   * `PbpGameLog` JSON blob plus engine version for Slice C Gamecast stepping.
   * Upsert-by-fixture: re-sim replaces the prior log.
   */
  gamePlayLogs: defineTable({
    fixtureId: v.id("fixtures"),
    seasonId: v.id("seasons"),
    logJson: v.string(),
    engineVersion: v.string(),
    createdAt: v.string(),
    createdBy: v.string(),
  }).index("by_fixtureId", ["fixtureId"]),

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
    size: v.number(), // next power of two ≥ teamCount (byes fill the gap)
    rounds: v.number(), // log2(size) — winners-bracket rounds for double-elim
    createdAt: v.string(),
    createdBy: v.string(),
    // "single" | "double". Optional for back-compat (legacy rows = single-elim).
    format: v.optional(v.string()),
    // Number of qualifying teams (≤ size). Optional for legacy rows.
    teamCount: v.optional(v.number()),
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
    // Double-elim (WSM-flex-brackets). Optional → legacy single-elim rows valid.
    // "winners" | "losers" | "grandFinal"; undefined = single-elim.
    bracketType: v.optional(v.string()),
    // Where the LOSER of this matchup drops (double-elim WB → LB routing).
    // Self-referential id stored as a string (same rationale as nextMatchupId).
    loserNextMatchupId: v.optional(v.union(v.string(), v.null())),
    loserNextSlot: v.optional(v.union(v.string(), v.null())), // "home" | "away"
  })
    .index("by_bracketId", ["bracketId"])
    .index("by_seasonId", ["seasonId"]),
};
