import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import type { Tier } from "./tiers";
import { getLeagueOrgId } from "./org-context";
import { getSalesforceConnection } from "./salesforce";

export interface AuthorizationResult {
  userId: string;
  isAuthorized: boolean;
}

/**
 * Authorize a mutation on a team. The chain is:
 * teamId -> Team__c.League__c -> League__c.Clerk_Org_Id__c -> requireOrgAdmin
 *
 * Public leagues (null orgId) -> mutations denied (read-only).
 * Org leagues -> only org:admin can mutate.
 */
export async function authorizeTeamMutation(
  teamId: string,
  userId: string,
): Promise<AuthorizationResult> {
  try {
    // Get team's league
    const conn = await getSalesforceConnection();
    const result = await conn.query<{ League__c: string }>(
      `SELECT League__c FROM Team__c WHERE Id = '${teamId}' LIMIT 1`,
    );
    if (result.totalSize === 0) {
      return { userId, isAuthorized: false };
    }

    const leagueId = result.records[0].League__c;
    const orgId = await getLeagueOrgId(leagueId);

    // Public leagues are read-only
    if (!orgId) {
      return { userId, isAuthorized: false };
    }

    // Check if user is org admin
    const client = await clerkClient();
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
    });
    const membership = memberships.data.find(
      (m) => m.organization.id === orgId,
    );

    return {
      userId,
      isAuthorized: membership?.role === "org:admin",
    };
  } catch {
    return { userId, isAuthorized: false };
  }
}

/**
 * Check if user can manage a team (for UI display).
 */
export async function canManageTeam(
  teamId: string,
  userId: string,
): Promise<boolean> {
  const result = await authorizeTeamMutation(teamId, userId);
  return result.isAuthorized;
}

/**
 * Reads the current user's subscription tier from Clerk publicMetadata.
 * Defaults to "free" if no tier is set.
 */
export async function getUserTier(): Promise<Tier> {
  const user = await currentUser();
  const tier = user?.publicMetadata?.tier as Tier | undefined;
  return tier ?? "free";
}

/**
 * Reads the current user's Stripe customer ID from privateMetadata.
 * Returns null if the user has never subscribed.
 *
 * Server-only -- privateMetadata is never exposed to the client.
 */
export async function getStripeCustomerId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const customerId = user.privateMetadata?.stripeCustomerId as
    | string
    | undefined;
  return customerId ?? null;
}
