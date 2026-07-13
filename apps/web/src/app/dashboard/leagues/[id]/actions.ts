"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  getLeagueOrgId,
  setLeaguePublic as setLeaguePublicMutation,
  setLeagueClaimable as setLeagueClaimableMutation,
} from "@/lib/data-api";
import { getUserRoleInOrg } from "@/lib/org-context";

/**
 * Server action — flip the `leagues.isPublic` field that drives the
 * public viewer route gating (WSM-000059 / WSM-000061).
 *
 * Auth: caller must be org:admin of the league's owning Clerk org.
 */
export async function setLeaguePublicAction(
  leagueId: string,
  isPublic: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgId = await getLeagueOrgId(leagueId);
  if (!orgId) return { ok: false, error: "league_not_owned" };

  const role = await getUserRoleInOrg(orgId, userId);
  if (role !== "org:admin") return { ok: false, error: "not_admin" };

  await setLeaguePublicMutation(leagueId, isPublic);
  revalidatePath(`/dashboard/leagues/${leagueId}`);
  revalidatePath(`/dashboard/leagues/${leagueId}/manage`);
  return { ok: true };
}

/**
 * Server action — flip the `leagues.claimable` field that lets coaches claim a
 * team from a public template league (WSM-000109). Claiming requires the league
 * to be BOTH public and claimable, so this only takes effect once "Public
 * viewer" is also on.
 *
 * Auth: caller must be org:admin of the league's owning Clerk org.
 */
export async function setLeagueClaimableAction(
  leagueId: string,
  claimable: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgId = await getLeagueOrgId(leagueId);
  if (!orgId) return { ok: false, error: "league_not_owned" };

  const role = await getUserRoleInOrg(orgId, userId);
  if (role !== "org:admin") return { ok: false, error: "not_admin" };

  await setLeagueClaimableMutation(leagueId, claimable);
  revalidatePath(`/dashboard/leagues/${leagueId}`);
  revalidatePath(`/dashboard/leagues/${leagueId}/manage`);
  return { ok: true };
}
