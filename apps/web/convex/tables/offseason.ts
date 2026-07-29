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
   * Persisted offseason phase machine (Dynasty Mode B1).
   *
   * One row per target season. The phase used to be DERIVED from draft status
   * in the stepper, which made it unresumable, ungateable and invisible to any
   * audit — and would have had to be rewritten once phases outnumbered the
   * draft.
   *
   * `seasonRollovers` still owns the automatic, lease-protected mechanical
   * stages. This table owns the human-paced ones. The two are separate because
   * a 60-second lease is coherent for a stage that runs in one server action
   * and incoherent for a phase an admin sits in for three days.
   *
   * `completedPhases` is a SET, not a high-water mark, so inserting a phase
   * into the middle of the machine later never forces a migration.
   */
  offseasons: defineTable({
    leagueId: v.id("leagues"),
    /** The UPCOMING season being prepared, not the one that just finished. */
    seasonId: v.id("seasons"),
    phase: v.string(),
    completedPhases: v.array(v.string()),
    /*
     * Budgets are SNAPSHOT at open, alongside `configJson`. An admin who
     * raises `scoutingPointsPerOffseason` halfway through must not retroactively
     * refund an offseason that has already been half spent under the old value.
     * B3 and B6 are the consumers; nothing spends them yet.
     */
    scoutingPointsTotal: v.number(),
    scoutingPointsSpent: v.number(),
    trainingPointsTotal: v.number(),
    trainingPointsSpent: v.number(),
    /** `DynastyConfig` as of open — see the budget note above. */
    configJson: v.string(),
    /*
     * Advance lease. Short-lived and held only across an advance, never across
     * phase occupancy. B2+ phases do real work between claim and commit; today
     * it exists so a second admin clicking Advance loses cleanly rather than
     * double-running that work.
     */
    leasePhase: v.optional(v.string()),
    leaseOwnerId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.string()),
    lastError: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    updatedBy: v.string(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_leagueId", ["leagueId"]),

  /*
   * Incoming freshman class (Dynasty Mode B3). One row per prospect, one class
   * per target season, shared by every team in the league.
   *
   * ## The hidden/shown split is the table's whole reason for existing
   *
   * `trueAttributesJson`, `trueOverall` and `potentialTier` are the prospect.
   * `scoutedAttributesJson`, `projectedLow` and `projectedHigh` are what a coach
   * has earned the right to see. They are stored side by side rather than
   * derived on read so that the shown numbers are STABLE — a range that
   * recomputed on every page load would drift under the coach even though the
   * generator is deterministic, and any future change to the noise function
   * would silently rewrite history for classes already scouted.
   *
   * Nothing outside `convex/dynasty.ts` may read the hidden three. `listProspects`
   * has no validator entry for them, and `__tests__/prospectsHideTruth.test.ts`
   * fails if one is added — a leak here is not a cosmetic bug, it deletes the
   * entire mechanic.
   *
   * ## Signing
   *
   * `playerId` is the record that a prospect became a player, and it is what
   * makes signing idempotent: a set `playerId` means the work is done, so a
   * retried request returns the existing player instead of creating a second
   * one. `signedTeamId` is stored alongside rather than read back through the
   * player because a signed player can later be released or traded, and the
   * class should keep saying who actually recruited him.
   */
  recruitProspects: defineTable({
    leagueId: v.id("leagues"),
    /** The UPCOMING season this class signs into. */
    seasonId: v.id("seasons"),
    name: v.string(),
    position: v.string(),
    positionGroup: v.string(),
    /** Shown at every scout level — the read a coach gets from film. */
    archetype: v.string(),
    hometown: v.union(v.string(), v.null()),

    /** HIDDEN. Never in a `returns:` validator reachable from the Next layer. */
    trueAttributesJson: v.string(),
    /** HIDDEN. The number the projected band is built around. */
    trueOverall: v.number(),
    /** HIDDEN at every level, including 3 — this is where bust risk lives. */
    potentialTier: v.string(),

    /** 0–3. Higher is a narrower `projectedLow`..`projectedHigh` window. */
    scoutLevel: v.number(),
    scoutedAttributesJson: v.string(),
    projectedLow: v.number(),
    projectedHigh: v.number(),

    signedTeamId: v.optional(v.id("teams")),
    playerId: v.optional(v.id("players")),
    signedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_leagueId", ["leagueId"]),

  /*
   * Offseason transfers (Dynasty Mode B4). One row per DECISION, not per move.
   *
   * A player who wants out produces one `out` row (his current coach's decision:
   * retain him or let him go) and up to `OFFERS_PER_TRANSFER` `in` rows (each
   * destination coach's decision). They share a `playerId`, which is what lets
   * one resolution withdraw the others — retaining a player kills every offer
   * for him, and the first destination to accept kills its rivals.
   *
   * ## Why the direction is stored rather than derived
   *
   * `fromTeamId` and `toTeamId` would nearly determine it: an `out` row has no
   * destination yet. But "nearly" is the problem — the two rows for the same
   * move would then be distinguished by a null, and every query that wanted one
   * side would encode that trick. Storing the direction makes
   * `by_seasonId_status` usable for both panels without a second index.
   *
   * `likelihood` is kept after generation even though it is only read once, so
   * a coach can see how close a call it was and so a slate can be audited
   * against `transferOutLikelihood` without re-deriving depth charts that have
   * since changed.
   */
  transferEvents: defineTable({
    leagueId: v.id("leagues"),
    /** The UPCOMING season this window belongs to. */
    seasonId: v.id("seasons"),
    playerId: v.id("players"),
    /** "out" | "in" — see the note above. */
    direction: v.string(),
    /** The program losing him. Always set: transfers are conserved. */
    fromTeamId: v.id("teams"),
    /** The program offering a spot. Null on the `out` row. */
    toTeamId: v.union(v.id("teams"), v.null()),
    /** "buried" | "role" | "opportunity" — the argument the coach answers. */
    reason: v.string(),
    /** 0–1 chance that produced this row, kept for audit. */
    likelihood: v.number(),
    /** "pending" | "accepted" | "rejected" | "withdrawn". */
    status: v.string(),
    resolvedAt: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_seasonId", ["seasonId"])
    .index("by_seasonId_status", ["seasonId", "status"])
    .index("by_playerId", ["playerId"])
    .index("by_leagueId", ["leagueId"]),

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
