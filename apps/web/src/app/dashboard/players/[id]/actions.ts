"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { playerAttributesV1 } from "@/lib/flags";
import {
  getPlayer,
  getTeamLeagueId,
  getLeagueOrgId,
  updatePlayerAttributes,
  getPlayerSeasonAttributes,
} from "@/lib/data-api";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";
import { validatePlayerAttributeEdit } from "@/lib/attributes/known-keys";
import { attributeGroupForPosition } from "@/lib/synthetic-attributes";

/**
 * Coach/admin manual edit of a player's current-season SPRT attribute snapshot.
 * Viewers are rejected; validation enforces known keys and 0–99 integers.
 */
export async function updatePlayerAttributesAction(
  playerId: string,
  attributes: Record<string, number>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const enabled = await playerAttributesV1();
  if (!enabled) return { ok: false, error: "flag_disabled" };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  const player = await getPlayer(playerId, orgContext).catch(() => null);
  if (!player) return { ok: false, error: "player_not_found" };

  const leagueId = await getTeamLeagueId(player.teamId).catch(() => null);
  if (!leagueId) return { ok: false, error: "league_not_found" };

  const orgId = await getLeagueOrgId(leagueId);
  if (!orgId) return { ok: false, error: "league_not_owned" };

  const role = await resolveOrgRole(orgId, userId);
  if (!canManageRoster(role)) return { ok: false, error: "not_authorized" };

  const validated = validatePlayerAttributeEdit(attributes);
  if (!validated.ok) return { ok: false, error: validated.error };

  const existing = await getPlayerSeasonAttributes(playerId, orgContext).catch(
    () => null,
  );
  const positionGroup =
    existing?.positionGroup ??
    attributeGroupForPosition(player.position);

  try {
    await updatePlayerAttributes({
      playerId,
      positionGroup,
      attributes: validated.normalized,
      weightedOverall: validated.weightedOverall,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  revalidatePath(`/dashboard/players/${playerId}`);
  return { ok: true };
}
