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

  /*
   * Per-league Dynasty Mode settings (F5).
   *
   * A feature flag is the wrong tool for a game mechanic: flags are per-deploy
   * and per-environment, but "this league finds injuries too punishing" is
   * per-league and needs changing at runtime. The roadmap therefore spends only
   * four flags total, and gates individual mechanics through these knobs — so a
   * live league can back out a mechanic without a deploy.
   *
   * EVERY field is optional and an absent document is legal. That is what makes
   * this table migration-free forever: adding a knob never requires a backfill,
   * because `resolveDynastyConfig` fills defaults for anything missing. Read it
   * through that resolver, never off the raw document.
   */
  /*
   * Player injuries (A4).
   *
   * `gamesOut` is the AUTHORITATIVE countdown, decremented once per team game
   * played. `returnsAfterWeek` is the projection shown in the UI — a bye or a
   * rescheduled fixture moves the real return date, and the countdown follows
   * while the projection does not.
   */
  playerInjuries: defineTable({
    leagueId: v.id("leagues"),
    seasonId: v.id("seasons"),
    teamId: v.id("teams"),
    playerId: v.id("players"),
    /** The fixture the injury happened in — also the dedupe key for a re-sim. */
    fixtureId: v.id("fixtures"),
    severity: v.string(),
    label: v.string(),
    /** Team games still to miss. 0 means available. */
    gamesOut: v.number(),
    /** What it was when it happened, so the UI can say "a 4-game injury". */
    initialGamesOut: v.number(),
    weekOccurred: v.union(v.number(), v.null()),
    returnsAfterWeek: v.union(v.number(), v.null()),
    /** "out" | "healed" */
    status: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_seasonId_status", ["seasonId", "status"])
    .index("by_playerId_seasonId", ["playerId", "seasonId"])
    .index("by_teamId_seasonId", ["teamId", "seasonId"])
    .index("by_fixtureId", ["fixtureId"]),

  dynastyConfig: defineTable({
    leagueId: v.id("leagues"),

    // Sim mechanics (Epic A). Kill switches for a live league.
    /** A1 — safeties, two-point tries, return TDs, fumbles on any play. */
    scoringDepthEnabled: v.optional(v.boolean()),
    penaltiesEnabled: v.optional(v.boolean()),
    /** A3 — fourth-down chart, timeouts, two-minute drill, clock management. */
    situationalAiEnabled: v.optional(v.boolean()),
    /** A3 — corrected home-field advantage (#642). */
    balanceTuningEnabled: v.optional(v.boolean()),
    injuriesEnabled: v.optional(v.boolean()),
    /** A6 — team schemes and coach tendencies shape play calling. */
    schemesEnabled: v.optional(v.boolean()),
    weatherEnabled: v.optional(v.boolean()),
    /** 0 = none, 1 = normal, 2 = brutal. Scales injury roll severity. */
    injurySeverityScale: v.optional(v.number()),

    // Offseason economy (Epic B).
    /** An incoming freshman class is generated and recruited (Epic B3). */
    recruitingEnabled: v.optional(v.boolean()),
    transfersEnabled: v.optional(v.boolean()),
    /** "low" | "normal" | "high" — how much roster churn a offseason produces. */
    transferVolume: v.optional(v.string()),
    scoutingPointsPerOffseason: v.optional(v.number()),
    trainingPointsPerOffseason: v.optional(v.number()),
    targetRosterSize: v.optional(v.number()),

    // Program and narrative (Epics C, D).
    jobSecurityEnabled: v.optional(v.boolean()),
    pollsEnabled: v.optional(v.boolean()),

    updatedAt: v.string(),
    updatedBy: v.string(),
  }).index("by_leagueId", ["leagueId"]),

  /*
   * Declared rivalries (A5).
   *
   * A rivalry is SYMMETRIC — "A vs B" and "B vs A" are one rivalry — so the row
   * carries a sorted `pairKey` alongside the two ids. Without it the same
   * rivalry could be stored twice with different intensities and the two rows
   * would disagree about how big the game is. `pairKey` is built by
   * `rivalryPairKey` in `src/lib/pbp/crowd.ts`; it is the deduplication key,
   * and the `by_leagueId_pairKey` index is what makes the check one read.
   *
   * `teamAId` / `teamBId` are also stored sorted, so a caller never has to
   * guess which side it is looking at.
   *
   * Absence is the norm: almost no pairing is a rivalry, and a league with no
   * rows here simulates exactly as it did before A5.
   */
  rivalries: defineTable({
    leagueId: v.id("leagues"),
    teamAId: v.id("teams"),
    teamBId: v.id("teams"),
    /** Sorted `${teamAId}|${teamBId}` — the unordered pair's primary key. */
    pairKey: v.string(),
    /** Display name, e.g. "The Backyard Brawl". Optional; falls back to the matchup. */
    name: v.optional(v.string()),
    /** 0-100. Damps home-field advantage — see `crowd.ts` for why. */
    intensity: v.number(),
    createdAt: v.string(),
    createdBy: v.string(),
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_leagueId_pairKey", ["leagueId", "pairKey"])
    // A fixture asks "is this matchup a rivalry" from either team's side.
    .index("by_teamAId", ["teamAId"])
    .index("by_teamBId", ["teamBId"]),
};
