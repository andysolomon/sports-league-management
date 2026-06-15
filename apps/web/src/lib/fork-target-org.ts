import { clerkClient } from "@clerk/nextjs/server";

/**
 * Resolve the org a fork should land in (WSM-000110/111/115/133), never making
 * the coach set one up first:
 *   1. the active org, if they admin it; else
 *   2. any org they already admin; else
 *   3. a freshly created org (they become its admin) — org-on-claim onboarding.
 * Returns the target org id and whether one was created. Shared by the per-team
 * claim route and the batch division/conference fork routes so org resolution
 * (and the org-on-claim path) stays identical across à la carte granularities.
 */
export async function resolveForkTargetOrg(params: {
  userId: string;
  orgId: string | null | undefined;
  orgRole: string | null | undefined;
  newOrgName: string;
}): Promise<{ targetOrgId: string; createdOrg: boolean }> {
  const { userId, orgId, orgRole, newOrgName } = params;

  if (orgId && orgRole === "org:admin") {
    return { targetOrgId: orgId, createdOrg: false };
  }

  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
  });
  const adminMembership = memberships.data.find((m) => m.role === "org:admin");
  if (adminMembership) {
    return { targetOrgId: adminMembership.organization.id, createdOrg: false };
  }

  // Org-on-claim: stand up the coach's organization behind the scenes.
  const org = await client.organizations.createOrganization({
    name: newOrgName,
    createdBy: userId,
  });
  return { targetOrgId: org.id, createdOrg: true };
}
