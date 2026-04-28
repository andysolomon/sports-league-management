import { cache } from "react";
import { clerkClient } from "@clerk/nextjs/server";
import { getVisibleLeagueContext as getVisibleLeagueContextFromConvex } from "./data-api";

export interface OrgContext {
  userId: string;
  orgIds: string[];
  visibleLeagueIds: string[];
  subscribedLeagueIds: string[];
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
    const { visibleLeagueIds, subscribedLeagueIds } =
      await getVisibleLeagueContextFromConvex(userId, orgIds);

    return { userId, orgIds, visibleLeagueIds, subscribedLeagueIds };
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
 * Returns the user's role within a specific Clerk Organization,
 * or null if they are not a member.
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

