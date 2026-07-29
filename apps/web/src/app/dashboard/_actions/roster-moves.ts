"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { canAdminOrManageTeam } from "@/lib/authorization";
import {
  changePlayerPosition,
  getTeamLeagueId,
  setPlayerSquad,
} from "@/lib/data-api";

/*
 * Roster shaping actions (Dynasty Mode B5).
 *
 * Both gate on `teamId`, like recruiting and transfers before them: promoting
 * a player and moving him to a new position are one program's decisions about
 * its own roster, and an action written against "is org admin" could not be
 * narrowed for Wave 5 without rewriting every call site.
 *
 * Cuts are NOT here. They go through `releaseToFreeAgencyAction` in
 * `offseason.ts`, which already resolves the player's own team and gates on it
 * — a stricter check than passing a `teamId` in, and one release path instead
 * of two sets of rules about what leaving a roster means.
 */

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function messageOf(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  /*
   * Convex wraps a thrown Error in its own message, so the bare reason the UI
   * switches on has to be recovered from the text — same recovery as
   * `transfers.ts` and `recruiting.ts`.
   */
  const known = [
    "player_not_found",
    "player_not_on_team",
    "invalid_squad",
    "invalid_position",
    "grade_unknown",
    "grade_too_low_for_varsity",
    "grade_requires_varsity",
    "season_locked",
    "season_not_found",
  ];
  return known.find((reason) => raw.includes(reason)) ?? raw;
}

/**
 * Revalidate everything a roster move is visible on.
 *
 * A promotion or position change shows up on the offseason hub, the team's
 * pages and the player's own — the depth chart in particular, since a position
 * change rewrites it. Missing one leaves a page asserting the old position
 * until something unrelated evicts the cache.
 */
async function revalidateRosterSurfaces(input: {
  teamId: string;
  seasonId: string;
  playerId: string;
}): Promise<void> {
  revalidatePath(`/dashboard/seasons/${input.seasonId}/offseason`);
  revalidatePath(`/dashboard/teams/${input.teamId}`);
  revalidatePath(`/dashboard/teams/${input.teamId}/roster`);
  revalidatePath(`/dashboard/teams/${input.teamId}/depth-chart`);
  revalidatePath(`/dashboard/players/${input.playerId}`);
  const leagueId = await getTeamLeagueId(input.teamId).catch(() => null);
  if (leagueId) revalidatePath(`/dashboard/leagues/${leagueId}`);
}

export async function setPlayerSquadAction(input: {
  playerId: string;
  teamId: string;
  seasonId: string;
  squad: string;
}): Promise<ActionResult<{ squad: string; changed: boolean }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canAdminOrManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await setPlayerSquad({
      playerId: input.playerId,
      teamId: input.teamId,
      seasonId: input.seasonId,
      squad: input.squad,
      actorUserId: userId,
    });
    await revalidateRosterSurfaces(input);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

export async function changePlayerPositionAction(input: {
  playerId: string;
  teamId: string;
  seasonId: string;
  position: string;
}): Promise<
  ActionResult<{ position: string; positionGroup: string; changed: boolean }>
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canAdminOrManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await changePlayerPosition({
      playerId: input.playerId,
      teamId: input.teamId,
      seasonId: input.seasonId,
      position: input.position,
      actorUserId: userId,
    });
    await revalidateRosterSurfaces(input);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}
