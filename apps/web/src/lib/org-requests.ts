import { clerkClient } from "@clerk/nextjs/server";

export interface PendingRequest {
  userId: string;
  email: string;
  requestedAt: string;
}

export async function getPendingRequests(orgId: string): Promise<PendingRequest[]> {
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  return (org.publicMetadata?.pendingRequests as PendingRequest[]) ?? [];
}

export async function addPendingRequest(
  orgId: string,
  userId: string,
  email: string,
): Promise<void> {
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  const existing = (org.publicMetadata?.pendingRequests as PendingRequest[]) ?? [];

  // Don't add duplicates
  if (existing.some((r) => r.userId === userId)) return;

  const updated = [
    ...existing,
    { userId, email, requestedAt: new Date().toISOString() },
  ];

  await client.organizations.updateOrganization(orgId, {
    publicMetadata: { ...org.publicMetadata, pendingRequests: updated },
  });
}

export async function removePendingRequest(
  orgId: string,
  requestUserId: string,
): Promise<void> {
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  const existing = (org.publicMetadata?.pendingRequests as PendingRequest[]) ?? [];

  const updated = existing.filter((r) => r.userId !== requestUserId);

  await client.organizations.updateOrganization(orgId, {
    publicMetadata: { ...org.publicMetadata, pendingRequests: updated },
  });
}
