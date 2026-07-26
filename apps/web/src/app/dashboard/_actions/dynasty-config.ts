"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import {
  getLeagueOrgId,
  setDynastyConfig as setDynastyConfigData,
} from "@/lib/data-api";
import type { DynastyConfig } from "@/lib/dynasty-config";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Save a league's Dynasty settings (F5).
 *
 * ORG-SETTINGS level, not coach level. These knobs change how every team's
 * games simulate and how large every roster may be, so they belong to whoever
 * runs the league — unlike the per-team offseason actions, which authorize on a
 * `teamId` so a coach can act on their own team.
 */
export async function saveDynastyConfigAction(input: {
  leagueId: string;
  patch: Partial<DynastyConfig>;
}): Promise<ActionResult<DynastyConfig>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  let orgId: string | null;
  try {
    orgId = await getLeagueOrgId(input.leagueId);
  } catch {
    return { ok: false, error: "league_not_found" };
  }
  if (!orgId) return { ok: false, error: "not_authorized" };

  const role = await resolveOrgRole(orgId, userId);
  if (!canManageOrgSettings(role)) return { ok: false, error: "not_authorized" };

  try {
    const data = await setDynastyConfigData({
      leagueId: input.leagueId,
      actorUserId: userId,
      patch: input.patch,
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
