"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { canAdminOrManageTeam } from "@/lib/authorization";
import { spendCoachSkillPoints } from "@/lib/data-api";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function messageOf(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const known = [
    "coach_not_found",
    "coach_not_on_team",
    "unknown_node",
    "prerequisites_not_met",
    "insufficient_points",
    "already_unlocked",
    "not_authorized",
  ];
  return known.find((reason) => raw.includes(reason)) ?? raw;
}

export async function spendCoachSkillPointsAction(input: {
  coachId: string;
  teamId: string;
  nodeId: string;
}): Promise<ActionResult<{ skillPoints: number | null }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canAdminOrManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }

  try {
    const coach = await spendCoachSkillPoints({
      coachId: input.coachId,
      teamId: input.teamId,
      nodeId: input.nodeId,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/coaches/${input.coachId}`);
    return { ok: true, data: { skillPoints: coach.skillPoints } };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}
