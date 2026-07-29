"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { canAdminOrManageTeam } from "@/lib/authorization";
import {
  scoutProspect,
  signProspect,
  type ProspectDto,
} from "@/lib/data-api";

/*
 * Recruiting actions (Dynasty Mode B3).
 *
 * Both actions authorize on a **teamId**, never on "is org admin" alone. This
 * is the roadmap's one non-negotiable multiplayer detail: in solo mode the
 * commissioner passes each team's id in turn, and in Wave 5 the identical
 * mutation serves a coach who owns exactly one. An action that only asked "are
 * you an admin" would have to be rewritten — along with every call site — the
 * day a second person joins a league.
 *
 * `canAdminOrManageTeam` comes from `@/lib/authorization` rather than being
 * redefined here, so "who may act for this team" has exactly one answer across
 * the offseason (B5 consolidated the four copies).
 */

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };


function messageOf(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  /*
   * Convex wraps a thrown Error in its own message, so the bare reason the UI
   * switches on has to be recovered from the text. Same recovery as
   * `offseason-phases.ts`; the list is the reasons this slice can produce.
   */
  const known = [
    "prospect_not_found",
    "prospect_already_signed",
    "prospect_fully_scouted",
    "scouting_budget_exhausted",
    "recruiting_class_full",
    "season_locked",
    "season_not_upcoming",
    "team_league_mismatch",
    "team_not_found",
  ];
  return known.find((reason) => raw.includes(reason)) ?? raw;
}

export async function scoutProspectAction(input: {
  prospectId: string;
  teamId: string;
  seasonId: string;
}): Promise<
  ActionResult<{
    prospect: ProspectDto;
    scoutingPointsSpent: number;
    scoutingPointsTotal: number;
  }>
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canAdminOrManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await scoutProspect({
      prospectId: input.prospectId,
      teamId: input.teamId,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/seasons/${input.seasonId}/offseason`);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

export async function signProspectAction(input: {
  prospectId: string;
  teamId: string;
  seasonId: string;
}): Promise<
  ActionResult<{
    prospect: ProspectDto;
    playerId: string;
    alreadySigned: boolean;
  }>
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canAdminOrManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await signProspect({
      prospectId: input.prospectId,
      teamId: input.teamId,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/seasons/${input.seasonId}/offseason`);
    revalidatePath(`/dashboard/teams/${input.teamId}`);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}
