import { cache } from "react";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getVisibleLeagueContext as getVisibleLeagueContextFromConvex,
  getOrgMemberRole,
} from "./data-api";
import type { OrgRole } from "./permissions";

export interface OrgContext {
  userId: string;
  orgIds: string[];
  visibleLeagueIds: string[];
  subscribedLeagueIds: string[];
  /**
   * À la carte import scopes (WSM-000100): leagueId → the team ids the user
   * imported from that league. Only present for PARTIAL subscriptions; a
   * league absent from this map means "all teams". A display filter for the
   * Teams/Players lists — not an access boundary.
   */
  subscriptionTeamScopes: Record<string, string[]>;
}

/**
 * Resolves the authenticated user's org memberships and the Convex league IDs
 * they are allowed to see. Uses React cache() to deduplicate within a single
 * request/render pass.
 *
 * Visible leagues = leagues owned by user's orgs + explicitly subscribed public
 * leagues. The org → league mapping is read from Convex via the `by_orgId`
 * index on the `leagues` table; the subscriptions list is read from the
 * Convex `leagueSubscriptions` table indexed by userId. Salesforce is no
 * longer in this read path (per Sprint 5).
 */
export const resolveOrgContext = cache(
  async (userId: string): Promise<OrgContext> => {
    const client = await clerkClient();

    // Get all orgs the user belongs to (handle pagination).
    const orgIds: string[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const memberships =
        await client.users.getOrganizationMembershipList({
          userId,
          limit,
          offset,
        });
      for (const m of memberships.data) {
        orgIds.push(m.organization.id);
      }
      hasMore = memberships.data.length === limit;
      offset += limit;
    }

    // Single Convex query resolves both visible-league fan-out (via the
    // `leagues.by_orgId` index for each org the user belongs to) and the
    // subscribed-league set (via `leagueSubscriptions.by_userId`).
    const { visibleLeagueIds, subscribedLeagueIds, subscriptionScopes } =
      await getVisibleLeagueContextFromConvex(userId, orgIds);

    // `?? []` keeps this resilient if the web deploys ahead of the Convex
    // function that adds subscriptionScopes — no scopes just means "import all".
    const subscriptionTeamScopes: Record<string, string[]> = {};
    for (const scope of subscriptionScopes ?? []) {
      subscriptionTeamScopes[scope.leagueId] = scope.teamIds;
    }

    return {
      userId,
      orgIds,
      visibleLeagueIds,
      subscribedLeagueIds,
      subscriptionTeamScopes,
    };
  },
);

/**
 * Check that a specific league is within the user's visible set.
 * Throws 403 if not.
 */
export function requireLeagueAccess(
  leagueId: string,
  orgContext: OrgContext,
): void {
  if (!orgContext.visibleLeagueIds.includes(leagueId)) {
    throw new Error("You do not have access to this league");
  }
}

/**
 * Check that the user is an admin of a specific Clerk Organization.
 * Used for mutations (create team, update player, etc.)
 */
export async function requireOrgAdmin(
  orgId: string,
  userId: string,
): Promise<void> {
  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
  });

  const membership = memberships.data.find(
    (m) => m.organization.id === orgId,
  );

  if (!membership || membership.role !== "org:admin") {
    throw new Error("You must be an admin of this league to make changes");
  }
}

/**
 * Returns the user's raw Clerk role within a specific Organization, or null if
 * they are not a member. Prefer `resolveOrgRole` for capability decisions — this
 * is the low-level Clerk read, used where the literal org:admin/org:member value
 * is needed (e.g. the members admin API).
 */
export async function getUserRoleInOrg(
  orgId: string,
  userId: string,
): Promise<"org:admin" | "org:member" | null> {
  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
  });
  const membership = memberships.data.find(
    (m) => m.organization.id === orgId,
  );
  if (!membership) return null;
  return membership.role as "org:admin" | "org:member";
}

/**
 * Resolves a user's effective capability role (admin/coach/viewer) in one org
 * (WSM-000121). Clerk `org:admin` → admin. An `org:member` is split via the
 * Convex `orgMemberRoles` sub-role, defaulting to viewer when no row exists.
 * Returns null if the user is not a member of the org.
 */
export async function resolveOrgRole(
  orgId: string,
  userId: string,
): Promise<OrgRole | null> {
  const clerkRole = await getUserRoleInOrg(orgId, userId);
  if (clerkRole === null) return null;
  if (clerkRole === "org:admin") return "admin";
  // org:member — coach unless explicitly stored, else viewer.
  const subRole = await getOrgMemberRole(orgId, userId).catch(() => null);
  return subRole === "coach" ? "coach" : "viewer";
}

const ROLE_RANK: Record<OrgRole, number> = { admin: 3, coach: 2, viewer: 1 };

/**
 * Resolves the STRONGEST capability role a user holds across several candidate
 * orgs (e.g. a team's league org and its workspace owner org). Returns null if
 * the user is a member of none. Used by team-level authorization.
 */
export async function resolveBestOrgRole(
  orgIds: Array<string | null | undefined>,
  userId: string,
): Promise<OrgRole | null> {
  const unique = Array.from(
    new Set(orgIds.filter((id): id is string => Boolean(id))),
  );
  let best: OrgRole | null = null;
  for (const orgId of unique) {
    const role = await resolveOrgRole(orgId, userId);
    if (role && (best === null || ROLE_RANK[role] > ROLE_RANK[best])) {
      best = role;
    }
  }
  return best;
}

