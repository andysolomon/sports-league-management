import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import type { Tier } from "./tiers";
import {
  getTeamLeagueId,
  getLeagueOrgId,
  getTeamOwnerOrgId,
  claimTeam,
} from "./data-api";
import { requireOrgAdmin } from "./org-context";

export interface AuthorizationResult {
  userId: string;
  isAuthorized: boolean;
}

/**
 * Authorize a mutation on a team. Edit rights come from being an `org:admin`
 * of EITHER:
 *   - the league's own org (owns the whole league), or
 *   - the org that CLAIMED this team (WSM-000109 Hybrid fork) — so a coach can
 *     edit their claimed team inside a shared/public template league.
 *
 * A team with neither a league org nor an owner org (e.g. an unclaimed team in
 * a public reference league) is read-only.
 */
export async function authorizeTeamMutation(
  teamId: string,
  userId: string,
): Promise<AuthorizationResult> {
  try {
    const leagueId = await getTeamLeagueId(teamId);
    const [leagueOrgId, ownerOrgId] = await Promise.all([
      getLeagueOrgId(leagueId),
      // Resilient if the Convex query deploys after the web: a missing owner
      // just means no team-claim grant — league-org auth still applies.
      getTeamOwnerOrgId(teamId).catch(() => null),
    ]);

    const candidateOrgIds = [leagueOrgId, ownerOrgId].filter(
      (id): id is string => Boolean(id),
    );
    if (candidateOrgIds.length === 0) {
      return { userId, isAuthorized: false };
    }

    const client = await clerkClient();
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
    });
    const isAuthorized = memberships.data.some(
      (m) =>
        candidateOrgIds.includes(m.organization.id) &&
        m.role === "org:admin",
    );

    return { userId, isAuthorized };
  } catch {
    return { userId, isAuthorized: false };
  }
}

/**
 * Claim a team into an org the user administers (WSM-000109). Verifies the
 * user is an `org:admin` of `orgId` before claiming — the org-admin gate the
 * Convex mutation can't enforce itself. Returns the claimed team's leagueId.
 */
export async function claimTeamForOrg(
  userId: string,
  orgId: string,
  teamId: string,
): Promise<{ leagueId: string }> {
  await requireOrgAdmin(orgId, userId); // throws if not an admin of orgId
  return claimTeam(userId, orgId, teamId);
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
