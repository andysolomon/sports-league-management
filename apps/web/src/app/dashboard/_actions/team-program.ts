"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { authorizeTeamMutation } from "@/lib/authorization";
import { setTeamProgram, type TeamProgramDto } from "@/lib/data-api";
import {
  isDefenseSchemeId,
  isOffenseSchemeId,
} from "@/lib/program/schemes";

/*
 * Set what a team runs (Dynasty Mode A6).
 *
 * ## The authorization choice that matters later
 *
 * This gates on `authorizeTeamMutation(teamId)` — the actor's role FOR THIS
 * TEAM — rather than on "is an org admin". In solo mode a commissioner passes
 * every team's id and the check is satisfied every time, so the two look
 * identical today. They stop being identical in the multi-coach wave, where a
 * coach must be able to set their own team's scheme and nobody else's, and the
 * difference between the two checks is the difference between adding a
 * parameter and rewriting the flow.
 *
 * Contrast with rivalries, which are deliberately org-admin: a rivalry changes
 * how a game between two OTHER teams plays. A scheme only changes your own.
 */

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function saveTeamProgramAction(input: {
  seasonId: string;
  teamId: string;
  offenseScheme?: string;
  defenseScheme?: string;
  tempo?: number;
  blitzRate?: number;
  aggression?: number;
}): Promise<ActionResult<TeamProgramDto>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const gate = await authorizeTeamMutation(input.teamId, userId);
  if (!gate.isAuthorized) return { ok: false, error: "not_authorized" };

  /*
   * Reject an unrecognized scheme HERE rather than letting it reach storage.
   *
   * The engine resolves an unknown id to neutral, so a bad value could not
   * break a simulation — but it would sit in the database looking like a
   * choice, and the team would quietly play as though it had chosen nothing.
   * A silent no-op is worse than an error at the point of the decision.
   */
  if (
    input.offenseScheme !== undefined &&
    !isOffenseSchemeId(input.offenseScheme)
  ) {
    return { ok: false, error: "unknown_offense_scheme" };
  }
  if (
    input.defenseScheme !== undefined &&
    !isDefenseSchemeId(input.defenseScheme)
  ) {
    return { ok: false, error: "unknown_defense_scheme" };
  }

  try {
    const data = await setTeamProgram({
      seasonId: input.seasonId,
      teamId: input.teamId,
      actorUserId: userId,
      offenseScheme: input.offenseScheme,
      defenseScheme: input.defenseScheme,
      tempo: input.tempo,
      blitzRate: input.blitzRate,
      aggression: input.aggression,
    });
    revalidatePath(`/dashboard/teams/${input.teamId}`);
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
