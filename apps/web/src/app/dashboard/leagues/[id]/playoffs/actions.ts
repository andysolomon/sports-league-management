"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { playoffsV1 } from "@/lib/flags";
import { generatePlayoffBracket, getLeague, getLeagueOrgId } from "@/lib/data-api";
import { resolveOrgRole, resolveOrgContext } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";

/*
 * Auth chain for playoff actions (mirrors the schedule manager gate):
 *   1. playoffsV1 flag enabled
 *   2. Clerk session present
 *   3. league visible to the user
 *   4. caller can manage rosters (admin or coach) of the league's org
 */
async function authorizePlayoffAction(
  leagueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const enabled = await playoffsV1();
  if (!enabled) return { ok: false, error: "flag_disabled" };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) return { ok: false, error: "league_not_found" };

  const orgId = await getLeagueOrgId(leagueId);
  if (!orgId) return { ok: false, error: "league_not_owned" };

  const role = await resolveOrgRole(orgId, userId);
  if (!canManageRoster(role)) return { ok: false, error: "not_authorized" };

  return { ok: true };
}

function friendlyError(code: string): string {
  if (code.includes("not_enough_teams")) {
    return "Not enough teams in the standings for a bracket of this size.";
  }
  if (code.includes("invalid_bracket_size")) {
    return "Bracket size must be 4, 8, or 16.";
  }
  if (code.includes("season_not_found")) {
    return "This season no longer exists.";
  }
  return "Could not generate the bracket.";
}

/*
 * Seed a single-elimination bracket from the season's standings (WSM-000164).
 * The mutation refuses to overwrite a bracket that already has a played game;
 * that surfaces here as `needsConfirm` so the UI can re-call with confirm.
 */
export async function generatePlayoffsAction(input: {
  leagueId: string;
  seasonId: string;
  size: number;
  confirm?: boolean;
}): Promise<
  | { ok: true; bracketId: string; size: number; rounds: number; matchups: number }
  | { ok: false; needsConfirm: true }
  | { ok: false; error: string }
> {
  const guard = await authorizePlayoffAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  try {
    const res = await generatePlayoffBracket({
      seasonId: input.seasonId,
      size: input.size,
      actorUserId: userId,
      confirm: input.confirm,
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}/playoffs`);
    return { ok: true, ...res };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("bracket_has_results")) {
      return { ok: false, needsConfirm: true };
    }
    return { ok: false, error: friendlyError(message) };
  }
}
