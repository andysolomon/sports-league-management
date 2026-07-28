"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import {
  deleteRivalry as deleteRivalryData,
  getLeagueOrgId,
  upsertRivalry as upsertRivalryData,
  type RivalryDto,
} from "@/lib/data-api";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Authorize a rivalry mutation.
 *
 * ORG-SETTINGS level, like the Dynasty settings card. A rivalry is a property
 * of the league schedule — it changes how a game between two OTHER teams
 * plays — so it is not something a single team's coach should be able to
 * declare unilaterally, even once multi-coach lands.
 */
async function requireLeagueAdmin(
  leagueId: string,
): Promise<{ userId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "unauthorized" };

  let orgId: string | null;
  try {
    orgId = await getLeagueOrgId(leagueId);
  } catch {
    return { error: "league_not_found" };
  }
  if (!orgId) return { error: "not_authorized" };

  const role = await resolveOrgRole(orgId, userId);
  if (!canManageOrgSettings(role)) return { error: "not_authorized" };

  return { userId };
}

export async function saveRivalryAction(input: {
  leagueId: string;
  teamAId: string;
  teamBId: string;
  name?: string;
  intensity?: number;
}): Promise<ActionResult<RivalryDto>> {
  const gate = await requireLeagueAdmin(input.leagueId);
  if ("error" in gate) return { ok: false, error: gate.error };

  try {
    const data = await upsertRivalryData({
      leagueId: input.leagueId,
      actorUserId: gate.userId,
      teamAId: input.teamAId,
      teamBId: input.teamBId,
      name: input.name,
      intensity: input.intensity,
    });
    revalidatePath("/dashboard/settings/league");
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function removeRivalryAction(input: {
  leagueId: string;
  rivalryId: string;
}): Promise<ActionResult<null>> {
  const gate = await requireLeagueAdmin(input.leagueId);
  if ("error" in gate) return { ok: false, error: gate.error };

  try {
    await deleteRivalryData(input.rivalryId);
    revalidatePath("/dashboard/settings/league");
    return { ok: true, data: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
