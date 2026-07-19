"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  createDivision,
  updateDivision as updateDivisionMutation,
  deleteDivision as deleteDivisionMutation,
  getDivisionLeagueId,
  getLeagueOrgId,
} from "@/lib/data-api";
import { getUserRoleInOrg } from "@/lib/org-context";

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

/** Pages that render division controls and must refresh after a mutation. */
function revalidateDivisionViews(): void {
  revalidatePath("/dashboard/leagues");
  revalidatePath("/dashboard/teams");
}

/** Org-admin gate for a division's league. Mirrors leagues/actions.ts. */
async function requireLeagueAdmin(
  leagueId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!leagueId) return { ok: false, error: "This can't be edited." };
  const orgId = await getLeagueOrgId(leagueId);
  if (!orgId) return { ok: false, error: "This league can't be edited." };
  const role = await getUserRoleInOrg(orgId, userId);
  if (role !== "org:admin") return { ok: false, error: "not_admin" };
  return { ok: true };
}

export async function createDivisionAction(
  leagueId: string,
  name: string,
): Promise<Result<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Division name is required." };
  const gate = await requireLeagueAdmin(leagueId);
  if (!gate.ok) return gate;
  try {
    const { dto } = await createDivision({ name: trimmed, leagueId });
    revalidateDivisionViews();
    return { ok: true, id: dto.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create division.",
    };
  }
}

export async function renameDivisionAction(
  divisionId: string,
  name: string,
): Promise<Result> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Division name is required." };
  const leagueId = await getDivisionLeagueId(divisionId);
  const gate = await requireLeagueAdmin(leagueId);
  if (!gate.ok) return gate;
  try {
    await updateDivisionMutation({ divisionId, name: trimmed });
    revalidateDivisionViews();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not rename division.",
    };
  }
}

export async function deleteDivisionAction(
  divisionId: string,
): Promise<Result<{ teamCount: number }>> {
  const leagueId = await getDivisionLeagueId(divisionId);
  const gate = await requireLeagueAdmin(leagueId);
  if (!gate.ok) return gate;
  try {
    // Teams in the division are reassigned to "no division", not deleted.
    const { teamCount } = await deleteDivisionMutation(divisionId);
    revalidateDivisionViews();
    return { ok: true, teamCount };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not delete division.",
    };
  }
}
