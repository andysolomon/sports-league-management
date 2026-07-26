import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Dynasty Mode foundation aggregates (Epic F).
 *
 * These tables exist so reads stop scanning. They hold no information that
 * cannot be rederived from the source rows — every one of them is a cache with
 * a repair path — which is what makes them safe to rebuild at any time.
 */
export const dynastyTables = {
  /*
   * Persisted per-team season record (F2).
   *
   * Standings used to be recomputed on EVERY read by scanning every fixture in
   * the season and fetching each result. This table collapses that to one
   * indexed read per season.
   *
   * It stores COUNTERS, not order. Ranking still runs through
   * `compareStandings` in `lib/standings.ts`, so the tiebreaker chain has
   * exactly one implementation and the existing standings tests keep covering
   * it.
   *
   * `divisionId` is a SNAPSHOT of the team's division while these games were
   * played. If a team changes division mid-season the divisional splits go
   * stale; `rebuildSeasonTeamRecords` is the repair path.
   *
   * Playoff fixtures are never counted (`stage === "playoff"`), matching the
   * pre-existing standings behavior.
   */
  seasonTeamRecords: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    divisionId: v.union(v.id("divisions"), v.null()),
    wins: v.number(),
    losses: v.number(),
    ties: v.number(),
    pointsFor: v.number(),
    pointsAgainst: v.number(),
    divisionWins: v.number(),
    divisionLosses: v.number(),
    divisionTies: v.number(),
    /** JSON `{ [opponentTeamId]: { w, l, t } }` — the head-to-head tiebreak. */
    headToHeadJson: v.string(),
    /** Positive = win streak, negative = loss streak, 0 = none or last was a tie. */
    streak: v.number(),
    /** "W" | "L" | "T", most recent first, capped at 10. */
    lastResults: v.array(v.string()),
    /** Final, non-playoff games folded into this row. */
    gamesCounted: v.number(),
    updatedAt: v.string(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_teamId", ["seasonId", "teamId"])
    // Program history across seasons (Epics C and D read this).
    .index("by_teamId", ["teamId"])
    .index("by_leagueId_seasonId", ["leagueId", "seasonId"]),

  /*
   * Persisted per-player season totals (F3).
   *
   * `computeSeasonSprt` and the `seasonStatLeaders` helper both collected every
   * `playerGameStats` row in a season, grouped by player, re-aggregated on each
   * read, and then issued a `ctx.db.get` PER PLAYER inside the loop (stat
   * leaders did two — player and team). This row is the pre-aggregated result,
   * so those reads become one indexed scan plus in-memory joins.
   *
   * It is also the layer career totals are built from in D1: never scan
   * `playerGameStats` for history — go
   * playerGameStats → playerSeasonAggregates → playerCareerTotals.
   *
   * Like `seasonTeamRecords`, this is a CACHE with a repair path
   * (`rebuildSeasonPlayerAggregates`); `totalsJson` is exactly what
   * `aggregateStatLines` produces over the player's game rows.
   *
   * `position` / `positionGroup` are a snapshot for downstream consumers. The
   * SPRT read path deliberately does NOT trust them for grouping — it joins
   * against live `players` rows — so an offseason position change (Epic B5)
   * cannot silently mis-rate a player before a rebuild runs.
   */
  playerSeasonAggregates: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    playerId: v.id("players"),
    position: v.string(),
    positionGroup: v.union(v.string(), v.null()),
    /** Games with an entered stat line. Feeds SPRT's per-game rates. */
    gamesPlayed: v.number(),
    /** `aggregateStatLines` output — sums, with "long" fields taking the max. */
    totalsJson: v.string(),
    updatedAt: v.string(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_playerId_seasonId", ["playerId", "seasonId"])
    // Career totals (D1): a HS player has at most four rows here.
    .index("by_playerId", ["playerId"])
    .index("by_leagueId_seasonId", ["leagueId", "seasonId"]),

  /*
   * Dynasty event log (F4) — the single source of "what happened".
   *
   * Every narrative surface reads this: the news feed and season recap (D4),
   * record-broken notices (D1), award announcements (D2). Producers span every
   * epic — injuries (A4), transfers (B4), hire/fire and goals (C2) — which is
   * exactly why it is ONE table with a `category`/`type` pair rather than a
   * table per feature. A new event type is a new string, not a migration.
   *
   * `headline` is PRE-RENDERED at write time by `lib/narrative.ts`, inside
   * Convex, so user-facing copy has one source of truth and stays
   * unit-testable. Templates are deterministic; nothing here is generated.
   *
   * `dedupeKey` is what makes re-simulation safe. It deliberately EXCLUDES the
   * engine version, so re-running a fixture under a new engine updates the
   * existing row rather than adding a second one — a dynasty replayed twice
   * must not produce a doubled newspaper.
   */
  dynastyEvents: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.union(v.id("seasons"), v.null()),
    /** Regular-season week, when the event belongs to one. */
    week: v.union(v.number(), v.null()),
    /** "game" | "injury" | "roster" | "award" | "program" | "offseason" | "poll" | "record" */
    category: v.string(),
    /** Specific event, e.g. "game_final" | "player_injured" | "record_broken". */
    eventType: v.string(),
    /** "info" | "notable" | "headline" — drives feed prominence. */
    severity: v.string(),
    teamId: v.union(v.id("teams"), v.null()),
    playerId: v.union(v.id("players"), v.null()),
    fixtureId: v.union(v.id("fixtures"), v.null()),
    /** Rendered copy. See `lib/narrative.ts`. */
    headline: v.string(),
    /** Structured payload for surfaces that want more than the headline. */
    detailJson: v.union(v.string(), v.null()),
    /** Stable identity for this happening — see the note above. */
    dedupeKey: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_leagueId_createdAt", ["leagueId", "createdAt"])
    .index("by_seasonId_week", ["seasonId", "week"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_playerId", ["playerId"])
    .index("by_teamId", ["teamId"]),
};
