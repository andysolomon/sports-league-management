import { cache } from "react";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getVisibleLeagueContext as getVisibleLeagueContextFromConvex,
  getOrgMemberRole,
} from "./data-api";
import type { OrgRole } from "./permissions";

/**
 * Minimal structural shape of a Clerk org membership as consumed here. The
 * SDK's OrganizationMembership satisfies this; keeping it structural lets the
 * fail-soft helper below stay decoupled from Clerk SDK type churn.
 */
interface OrgMembershipLike {
  organization: { id: string };
  role: string;
}

/**
 * Extracts the machine-readable error code from a ClerkAPIResponseError-shaped
 * throw (e.g. "organization_not_enabled_in_instance" when the Clerk instance
 * has the Organizations feature disabled — the WSM-000206 production incident).
 * Returns null for non-Clerk errors.
 */
function extractClerkErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const errors = (error as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const code = (errors[0] as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Fetches ALL of a user's Clerk org memberships (paginated), failing SOFT:
 * any Clerk org-API error is logged as one structured JSON line and treated
 * as "user has no organizations" instead of propagating. A Clerk outage or
 * misconfiguration (e.g. Organizations feature disabled on the instance) must
 * degrade the dashboard to the empty-workspace view, never 500 it
 * (WSM-000206 / #456).
 */
async function listOrgMembershipsFailSoft(
  userId: string,
  caller: string,
): Promise<OrgMembershipLike[]> {
  try {
    const client = await clerkClient();
    const memberships: OrgMembershipLike[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const page = await client.users.getOrganizationMembershipList({
        userId,
        limit,
        offset,
      });
      memberships.push(...page.data);
      hasMore = page.data.length === limit;
      offset += limit;
    }
    return memberships;
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        source: "org-context",
        message: `Clerk org membership lookup failed in ${caller}; degrading to no-org context`,
        clerkErrorCode: extractClerkErrorCode(error),
        error: error instanceof Error ? error.message : String(error),
        userId,
      }),
    );
    return [];
  }
}

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
    // Fail-soft: a Clerk org-API failure yields no org memberships, so the
    // user degrades to the same context as a user with no organizations
    // (subscribed public leagues still resolve via Convex below).
    const memberships = await listOrgMembershipsFailSoft(
      userId,
      "resolveOrgContext",
    );
    const orgIds = memberships.map((m) => m.organization.id);

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
 *
 * Fail-soft note: if the Clerk org API itself fails, the user is treated as a
 * non-member and gets the controlled "must be an admin" error below (fail
 * CLOSED for mutations, but never a raw Clerk crash).
 */
export async function requireOrgAdmin(
  orgId: string,
  userId: string,
): Promise<void> {
  const memberships = await listOrgMembershipsFailSoft(
    userId,
    "requireOrgAdmin",
  );

  const membership = memberships.find((m) => m.organization.id === orgId);

  if (!membership || membership.role !== "org:admin") {
    throw new Error("You must be an admin of this league to make changes");
  }
}

/**
 * Returns the user's raw Clerk role within a specific Organization, or null if
 * they are not a member. Prefer `resolveOrgRole` for capability decisions — this
 * is the low-level Clerk read, used where the literal org:admin/org:member value
 * is needed (e.g. the members admin API).
 *
 * Fail-soft: a Clerk org-API failure resolves to null (not a member), which
 * also protects resolveOrgRole / resolveBestOrgRole callers.
 */
export async function getUserRoleInOrg(
  orgId: string,
  userId: string,
): Promise<"org:admin" | "org:member" | null> {
  const memberships = await listOrgMembershipsFailSoft(
    userId,
    "getUserRoleInOrg",
  );
  const membership = memberships.find((m) => m.organization.id === orgId);
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

