import { cache } from "react";
import { clerkClient } from "@clerk/nextjs/server";
import { getSalesforceConnection } from "./salesforce";

export interface OrgContext {
  userId: string;
  orgIds: string[];
  visibleLeagueIds: string[];
}

/**
 * Resolves the authenticated user's org memberships and the Salesforce league IDs
 * they are allowed to see. Uses React cache() to deduplicate within a single
 * request/render pass.
 *
 * Visible leagues = leagues owned by user's orgs + public leagues (Clerk_Org_Id__c = null).
 */
export const resolveOrgContext = cache(
  async (userId: string): Promise<OrgContext> => {
    const client = await clerkClient();

    // Get all orgs the user belongs to (handle pagination)
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

    // Query Salesforce for leagues the user can see
    const conn = await getSalesforceConnection();
    let soql: string;

    if (orgIds.length === 0) {
      // User has no orgs — can only see public leagues
      soql = `SELECT Id FROM League__c WHERE Clerk_Org_Id__c = null`;
    } else {
      const orgIdList = orgIds.map((id) => `'${id}'`).join(",");
      soql = `SELECT Id FROM League__c WHERE Clerk_Org_Id__c IN (${orgIdList}) OR Clerk_Org_Id__c = null`;
    }

    const result = await conn.query<{ Id: string }>(soql);
    const visibleLeagueIds = result.records.map((r) => r.Id);

    return { userId, orgIds, visibleLeagueIds };
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
 * Find the Clerk Org ID that owns a given league.
 * Returns null for public leagues.
 */
export async function getLeagueOrgId(
  leagueId: string,
): Promise<string | null> {
  const conn = await getSalesforceConnection();
  const result = await conn.query<{ Clerk_Org_Id__c: string | null }>(
    `SELECT Clerk_Org_Id__c FROM League__c WHERE Id = '${leagueId}' LIMIT 1`,
  );
  if (result.totalSize === 0) {
    throw new Error("League not found");
  }
  return result.records[0].Clerk_Org_Id__c ?? null;
}
