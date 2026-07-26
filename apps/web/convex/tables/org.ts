import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Org/account-scoped state: league subscriptions, sync config and the intra-org
 * capability roles that split an org member into coach vs viewer. Definitions
 * moved verbatim from `schema.ts` (Dynasty Mode F1).
 */
export const orgTables = {
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
};
