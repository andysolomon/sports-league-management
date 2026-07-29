"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { authorizeTeamMutation } from "@/lib/authorization";
import {
  setFixtureGameplan,
  type FixtureGameplanDto,
} from "@/lib/data-api";
import { isGameplanFocus } from "@/lib/program/gameplan";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function saveFixtureGameplanAction(input: {
  fixtureId: string;
  seasonId: string;
  teamId: string;
  focus?: string;
}): Promise<ActionResult<FixtureGameplanDto>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const gate = await authorizeTeamMutation(input.teamId, userId);
  if (!gate.isAuthorized) return { ok: false, error: "not_authorized" };

  if (input.focus !== undefined && !isGameplanFocus(input.focus)) {
    return { ok: false, error: "unknown_gameplan_focus" };
  }

  try {
    const data = await setFixtureGameplan({
      fixtureId: input.fixtureId,
      teamId: input.teamId,
      actorUserId: userId,
      focus: input.focus,
    });
    revalidatePath(`/dashboard/seasons/${input.seasonId}/schedule`);
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
