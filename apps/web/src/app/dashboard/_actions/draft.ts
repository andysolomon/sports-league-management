"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import {
  getLeagueOrgId,
  startDraft,
  makeDraftPick,
  endDraft,
} from "@/lib/data-api";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireOrgAdmin(
  userId: string,
  leagueId: string,
): Promise<boolean> {
  const orgId = await getLeagueOrgId(leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  return canManageOrgSettings(role);
}

export async function startDraftAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<ActionResult<{ draftId: string; order: string[] }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  if (!orgContext.visibleLeagueIds.includes(input.leagueId)) {
    return { ok: false, error: "not_authorized" };
  }
  if (!(await requireOrgAdmin(userId, input.leagueId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await startDraft({
      leagueId: input.leagueId,
      seasonId: input.seasonId,
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    revalidatePath(`/dashboard/seasons/${input.seasonId}`);
    revalidatePath("/dashboard/seasons");
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function makeDraftPickAction(input: {
  draftId: string;
  playerId: string;
  leagueId: string;
  seasonId: string;
}): Promise<
  ActionResult<Awaited<ReturnType<typeof makeDraftPick>>>
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  if (!orgContext.visibleLeagueIds.includes(input.leagueId)) {
    return { ok: false, error: "not_authorized" };
  }
  if (!(await requireOrgAdmin(userId, input.leagueId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await makeDraftPick({
      draftId: input.draftId,
      playerId: input.playerId,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    revalidatePath(`/dashboard/seasons/${input.seasonId}`);
    revalidatePath("/dashboard/seasons");
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function endDraftAction(input: {
  draftId: string;
  leagueId: string;
  seasonId: string;
}): Promise<ActionResult<{ draftId: string; status: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  if (!orgContext.visibleLeagueIds.includes(input.leagueId)) {
    return { ok: false, error: "not_authorized" };
  }
  if (!(await requireOrgAdmin(userId, input.leagueId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await endDraft({ draftId: input.draftId });
    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    revalidatePath(`/dashboard/seasons/${input.seasonId}`);
    revalidatePath("/dashboard/seasons");
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
