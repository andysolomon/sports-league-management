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
};
