"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { canAdminOrManageTeam } from "@/lib/authorization";
import {
  allocateTraining,
  getTeamLeagueId,
  type TrainingAllocationDto,
} from "@/lib/data-api";

/*
 * Offseason training actions (Dynasty Mode B6).
 *
 * Gated on `teamId`, like recruiting, transfers and roster moves before it.
 * Spending a program's training budget is that program's decision, and an
 * action written against "is org admin" could not be narrowed for Wave 5
 * without rewriting every call site.
 *
 * Applying the allocations is NOT here — it runs from the phase advance in
 * `offseason-phases.ts`, which is an org-admin action because leaving a phase
 * moves every team in the league at once.
 */

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function messageOf(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  /*
   * Convex wraps a thrown Error in its own message, so the bare reason the UI
   * switches on has to be recovered from the text — same recovery as
   * `roster-moves.ts` and `transfers.ts`.
   */
  const known = [
    "player_not_found",
    "player_not_on_team",
    "invalid_focus",
    "invalid_points",
    "training_budget_exhausted",
    "season_locked",
    "season_not_found",
    "season_not_upcoming",
  ];
  return known.find((reason) => raw.includes(reason)) ?? raw;
}

export async function allocateTrainingAction(input: {
  playerId: string;
  teamId: string;
  seasonId: string;
  focus: string;
  points: number;
}): Promise<
  ActionResult<{
    allocation: TrainingAllocationDto;
    pointsSpent: number;
    pointsTotal: number;
  }>
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canAdminOrManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const data = await allocateTraining({
      playerId: input.playerId,
      teamId: input.teamId,
      seasonId: input.seasonId,
      focus: input.focus,
      points: input.points,
      actorUserId: userId,
    });

    /*
     * Only the hub. An allocation is a plan, not a rating change — the team,
     * roster and player pages still show what the player IS until the phase
     * advance applies it, and revalidating them here would suggest otherwise.
     */
    revalidatePath(`/dashboard/seasons/${input.seasonId}/offseason`);
    const leagueId = await getTeamLeagueId(input.teamId).catch(() => null);
    if (leagueId) revalidatePath(`/dashboard/leagues/${leagueId}`);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}
