import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Player rating snapshots: the canonical per-season attribute row and the
 * separate current Madden snapshot. Definitions moved verbatim from `schema.ts`
 * (Dynasty Mode F1).
 */
export const ratingsTables = {
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
};
