import { cache } from "react";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getLeagueOrgId as getLeagueOrgIdFromData,
  subscribeToLeague,
  getVisibleLeagueContext,
} from "./data-api";

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
 * Visible leagues = leagues owned by user's orgs + explicitly subscribed public leagues.
 */
export const resolveOrgContext = cache(
  async (userId: string): Promise<OrgContext> => {
    const client = await clerkClient();

    // Get all orgs the user belongs to (handle pagination)
    const orgIds: string[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    try {
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
    } catch (e) {
      console.error(
        "[OrgContext] Clerk getOrganizationMembershipList failed:",
        e,
      );
      // e.g. 403 when the secret key lacks Users:Read — continue with no org IDs
    }

    let { visibleLeagueIds, subscribedLeagueIds } =
      await getVisibleLeagueContext(userId, orgIds);

    // One-time bridge: migrate any legacy Clerk metadata subscriptions into Convex
    // so existing public-league access survives the backend cutover.
    if (subscribedLeagueIds.length === 0) {
      try {
        const user = await client.users.getUser(userId);
        const legacySubscribedLeagueIds =
          (user.publicMetadata?.subscribedLeagueIds as string[]) ?? [];

        if (legacySubscribedLeagueIds.length > 0) {
          await Promise.all(
            legacySubscribedLeagueIds.map((leagueId) =>
              subscribeToLeague(userId, leagueId).catch(() => undefined),
            ),
          );

          const refreshedContext = await getVisibleLeagueContext(userId, orgIds);
          visibleLeagueIds = refreshedContext.visibleLeagueIds;
          subscribedLeagueIds = refreshedContext.subscribedLeagueIds;
        }
      } catch {
        // Ignore legacy subscription migration failures; access will still be based
        // on Clerk org membership plus any Convex subscriptions already present.
      }
    }

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

/**
 * Find the Clerk Org ID that owns a given league.
 * Returns null for public leagues.
 */
export async function getLeagueOrgId(
  leagueId: string,
): Promise<string | null> {
  return getLeagueOrgIdFromData(leagueId);
}
