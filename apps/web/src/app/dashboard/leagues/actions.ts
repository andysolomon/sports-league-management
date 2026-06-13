"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  createLeague as createLeagueMutation,
  renameLeague as renameLeagueMutation,
  deleteLeague as deleteLeagueMutation,
  getLeagueOrgId,
} from "@/lib/data-api";
import { getUserRoleInOrg } from "@/lib/org-context";

type Result<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/** Resolve an org the user admins to own a new league — never blocking them. */
async function resolveAdminOrg(
  userId: string,
  activeOrgId: string | null | undefined,
  activeRole: string | null | undefined,
  newOrgName: string,
): Promise<string> {
  if (activeOrgId && activeRole === "org:admin") return activeOrgId;
  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
  });
  const admin = memberships.data.find((m) => m.role === "org:admin");
  if (admin) return admin.organization.id;
  const org = await client.organizations.createOrganization({
    name: newOrgName,
    createdBy: userId,
  });
  return org.id;
}

export async function createLeagueAction(
  name: string,
): Promise<Result<{ id: string }>> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "League name is required." };

  try {
    const targetOrg = await resolveAdminOrg(userId, orgId, orgRole, trimmed);
    const { id } = await createLeagueMutation(trimmed, targetOrg);
    revalidatePath("/dashboard/leagues");
    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create league.",
    };
  }
}

/** Shared org-admin gate for editing/removing an existing league. */
async function requireLeagueAdmin(
  leagueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  const orgId = await getLeagueOrgId(leagueId);
  if (!orgId) return { ok: false, error: "This league can't be edited." };
  const role = await getUserRoleInOrg(orgId, userId);
  if (role !== "org:admin") return { ok: false, error: "not_admin" };
  return { ok: true };
}

export async function renameLeagueAction(
  leagueId: string,
  name: string,
): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "League name is required." };
  const gate = await requireLeagueAdmin(leagueId);
  if (!gate.ok) return gate;
  await renameLeagueMutation(leagueId, trimmed);
  revalidatePath("/dashboard/leagues");
  revalidatePath(`/dashboard/leagues/${leagueId}`);
  return { ok: true };
}

export async function deleteLeagueAction(leagueId: string): Promise<Result> {
  const gate = await requireLeagueAdmin(leagueId);
  if (!gate.ok) return gate;
  await deleteLeagueMutation(leagueId);
  revalidatePath("/dashboard/leagues");
  return { ok: true };
}
