import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import type { Tier } from "./tiers";
import {
  getTeamLeagueId,
  getLeagueOrgId,
  getTeamOwnerOrgId,
  forkTeamToWorkspace,
} from "./data-api";
import { requireOrgAdmin, resolveBestOrgRole } from "./org-context";
import {
  canManageRoster,
  canManageOrgSettings,
  type OrgRole,
} from "./permissions";

export interface AuthorizationResult {
  userId: string;
  isAuthorized: boolean;
  /** The user's strongest role across the team's league/owner orgs (WSM-000121),
   *  or null if they hold no seat. Lets callers gate finer than a boolean. */
  role: OrgRole | null;
}

/**
 * Resolve a user's effective role on a team (WSM-000121). Rights flow from a
 * seat in EITHER:
 *   - the league's own org (owns the whole league), or
 *   - the org that forked/claimed this team into its workspace — so a coach can
 *     manage their team inside a shared/public template league.
 *
 * Returns the STRONGEST role across both. A team with neither a league org nor
 * an owner org (an unclaimed team in a public reference league) is read-only.
 */
export async function resolveTeamRole(
  teamId: string,
  userId: string,
): Promise<OrgRole | null> {
  const leagueId = await getTeamLeagueId(teamId);
  const [leagueOrgId, ownerOrgId] = await Promise.all([
    getLeagueOrgId(leagueId),
    // Resilient if the Convex query deploys after the web: a missing owner
    // just means no team-fork grant — league-org auth still applies.
    getTeamOwnerOrgId(teamId).catch(() => null),
  ]);
  return resolveBestOrgRole([leagueOrgId, ownerOrgId], userId);
}

/**
 * Authorize a roster/player/team-edit mutation on a team. Granted to admin OR
 * coach of the team's league/owner org (WSM-000121). For admin-only operations
 * (team deletion) use `authorizeTeamAdmin`.
 */
export async function authorizeTeamMutation(
  teamId: string,
  userId: string,
): Promise<AuthorizationResult> {
  try {
    const role = await resolveTeamRole(teamId, userId);
    return { userId, role, isAuthorized: canManageRoster(role) };
  } catch {
    return { userId, role: null, isAuthorized: false };
  }
}

/**
 * Authorize an admin-only operation on a team (deletion). Requires admin of the
 * team's league or owner org — coach is not enough.
 */
export async function authorizeTeamAdmin(
  teamId: string,
  userId: string,
): Promise<AuthorizationResult> {
  try {
    const role = await resolveTeamRole(teamId, userId);
    return { userId, role, isAuthorized: canManageOrgSettings(role) };
  } catch {
    return { userId, role: null, isAuthorized: false };
  }
}

/**
 * Fork a reference team into an org's private workspace (WSM-000114), verifying
 * the user admins the org first. The private-workspace replacement for the old
 * team-claim flow under the isolation model (RFC §11).
 */
export async function forkTeamForOrg(
  userId: string,
  orgId: string,
  sourceTeamId: string,
): Promise<{ teamId: string; leagueId: string; created: boolean }> {
  await requireOrgAdmin(orgId, userId);
  return forkTeamToWorkspace(orgId, sourceTeamId);
}

/**
 * Whether the user can manage a team's roster/players/details (admin or coach).
 * For UI display of Edit/Add/roster controls.
 */
export async function canManageTeam(
  teamId: string,
  userId: string,
): Promise<boolean> {
  const result = await authorizeTeamMutation(teamId, userId);
  return result.isAuthorized;
}

/**
 * Whether the user can administer a team (delete it) — admin only. Gates the
 * destructive "Remove Team" affordance (WSM-000121).
 */
export async function canAdministerTeam(
  teamId: string,
  userId: string,
): Promise<boolean> {
  const result = await authorizeTeamAdmin(teamId, userId);
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
