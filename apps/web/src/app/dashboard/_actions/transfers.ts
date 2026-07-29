"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { canAdminOrManageTeam } from "@/lib/authorization";
import { resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import {
  generateTransferWindow,
  getLeagueOrgId,
  getSeason,
  resolveTransfer,
} from "@/lib/data-api";

/*
 * Transfer actions (Dynasty Mode B4).
 *
 * Two different gates on purpose, because the two operations are different
 * kinds of decision:
 *
 * - Opening the window moves the whole league at once — it generates every
 *   team's slate in one write. That is a commissioner action, gated the same
 *   way advancing a phase is.
 * - Resolving a transfer is one program's call about one player, gated per
 *   `teamId`. This is the roadmap's multiplayer-critical shape: in Wave 5 the
 *   identical mutation serves a coach who owns exactly one team, and an action
 *   written against "is org admin" could not be narrowed without rewriting
 *   every call site.
 */

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };


function messageOf(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  /*
   * Convex wraps a thrown Error in its own message, so the bare reason the UI
   * switches on has to be recovered from the text — same recovery as
   * `offseason-phases.ts` and `recruiting.ts`.
   */
  const known = [
    "transfer_not_found",
    "transfer_not_pending",
    "transfer_not_released",
    "transfer_team_mismatch",
    "roster_full",
    "season_locked",
    "season_not_found",
    "team_league_mismatch",
    "invalid_decision",
  ];
  return known.find((reason) => raw.includes(reason)) ?? raw;
}

export async function openTransferWindowAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<ActionResult<{ outbound: number; offers: number }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgId = await getLeagueOrgId(input.leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  if (!canManageOrgSettings(role)) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await generateTransferWindow({
      seasonId: input.seasonId,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/seasons/${input.seasonId}/offseason`);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

export async function resolveTransferAction(input: {
  transferId: string;
  teamId: string;
  seasonId: string;
  decision: "accept" | "reject";
}): Promise<
  ActionResult<{ status: string; moved: boolean; withdrawn: number }>
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canAdminOrManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await resolveTransfer({
      transferId: input.transferId,
      teamId: input.teamId,
      decision: input.decision,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/seasons/${input.seasonId}/offseason`);
    revalidatePath(`/dashboard/teams/${input.teamId}`);
    /*
     * A completed transfer changes TWO rosters. Revalidating only the
     * destination would leave the losing program's page showing a player it no
     * longer has until something else happened to evict the cache.
     */
    if (data.moved) {
      const season = await getSeason(input.seasonId, {
        userId,
        orgIds: [],
        visibleLeagueIds: [],
        subscribedLeagueIds: [],
        subscriptionTeamScopes: {},
      }).catch(() => null);
      if (season) revalidatePath(`/dashboard/leagues/${season.leagueId}`);
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}
