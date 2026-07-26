import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Core league hierarchy: league → conference → division → team → player, plus
 * seasons. Definitions moved verbatim from `schema.ts` (Dynasty Mode F1) —
 * nothing here changed shape, so no migration is implied by the split.
 */
export const coreTables = {
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
    simulationFlavor: v.optional(v.string()), // "chalk" | "balanced" | "upsets"
  })
    .index("by_leagueId", ["leagueId"])
    .index("by_leagueId_name", ["leagueId", "name"]),
};
