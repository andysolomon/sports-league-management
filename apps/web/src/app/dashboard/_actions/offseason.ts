"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { canManageTeam } from "@/lib/authorization";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import {
  getLeagueOrgId,
  getPlayer,
  getTeamLeagueId,
  releasePlayerToFreeAgency,
  signFreeAgent,
} from "@/lib/data-api";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function canAdminOrManageTeam(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const leagueId = await getTeamLeagueId(teamId);
  const orgId = await getLeagueOrgId(leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  if (canManageOrgSettings(role)) return true;
  return canManageTeam(teamId, userId);
}

export async function releaseToFreeAgencyAction(input: {
  playerId: string;
}): Promise<ActionResult<{ playerId: string }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  let player;
  try {
    player = await getPlayer(input.playerId, orgContext);
  } catch {
    return { ok: false, error: "player_not_found" };
  }
  if (!(await canAdminOrManageTeam(userId, player.teamId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const leagueId = await getTeamLeagueId(player.teamId);
    const data = await releasePlayerToFreeAgency({ playerId: input.playerId });
    revalidatePath(`/dashboard/teams/${player.teamId}`);
    revalidatePath(`/dashboard/leagues/${leagueId}`);
    revalidatePath("/dashboard/seasons");
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function signFreeAgentAction(input: {
  playerId: string;
  teamId: string;
  seasonId: string;
}): Promise<
  ActionResult<{ playerId: string; teamId: string; overCap: boolean }>
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canAdminOrManageTeam(userId, input.teamId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const leagueId = await getTeamLeagueId(input.teamId);
    const data = await signFreeAgent({
      playerId: input.playerId,
      teamId: input.teamId,
      seasonId: input.seasonId,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/teams/${input.teamId}`);
    revalidatePath(`/dashboard/leagues/${leagueId}`);
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
