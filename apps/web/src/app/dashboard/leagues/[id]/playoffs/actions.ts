"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { playoffsV1 } from "@/lib/flags";
import {
  generatePlayoffBracket,
  getLeague,
  getLeagueOrgId,
  getPlayoffBracket,
  getSeasons,
  listFixturesBySeason,
} from "@/lib/data-api";
import { resolveOrgRole, resolveOrgContext } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";
import { canStartPlayoffs } from "@/lib/playoffs";
import { resolveLifecycleSeason } from "@/lib/season-view";

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
    return "Pick a playoff team count between 2 and 64.";
  }
  if (code.includes("season_not_found")) {
    return "This season no longer exists.";
  }
  if (code.includes("season_completed")) {
    return "season_completed";
  }
  return "Could not generate the bracket.";
}

/*
 * Seed a playoff bracket from the season's standings (WSM-000164,
 * WSM-flex-brackets). `size` is the qualifying team count (any value ≥ 2, with
 * byes for non-powers-of-two); `format` selects single/double elimination
 * (defaults to the season config). The mutation refuses to overwrite a bracket
 * that already has a played game; that surfaces here as `needsConfirm` so the
 * UI can re-call with confirm.
 */
export async function generatePlayoffsAction(input: {
  leagueId: string;
  seasonId: string;
  size: number;
  confirm?: boolean;
  format?: string;
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
      format: input.format,
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

function revalidatePlayoffPaths(leagueId: string) {
  revalidatePath(`/dashboard/leagues/${leagueId}/playoffs`);
  revalidatePath(`/dashboard/leagues/${leagueId}/schedule`);
  revalidatePath(`/dashboard/leagues/${leagueId}/standings`);
}

/*
 * Advance an active season to playoffs once every regular-season game is final
 * (WSM-bracket-view). Seeds and first-round fixtures come from the season's
 * configured playoff settings via the existing generatePlayoffBracket path.
 *
 * Season-safe (WSM-000239): the caller must name the season explicitly, and it
 * must be the league's lifecycle-decided season and not completed — a stale
 * page viewing an old season can never advance the wrong (or a finished) one.
 */
export async function advanceToPlayoffsAction(input: {
  leagueId: string;
  seasonId: string;
}): Promise<
  | { ok: true; bracketId: string; size: number; rounds: number; matchups: number }
  | { ok: false; error: string }
> {
  const guard = await authorizePlayoffAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  if (!input.seasonId) return { ok: false, error: "season_required" };

  const allSeasons = await getSeasons([input.leagueId]);
  if (allSeasons.length === 0) return { ok: false, error: "no_season" };

  // The named season must belong to this league…
  const activeSeason = allSeasons.find((s) => s.id === input.seasonId);
  if (!activeSeason) return { ok: false, error: "season_not_found" };

  // …must not already be finished…
  if (activeSeason.status === "completed") {
    return { ok: false, error: "season_completed" };
  }

  // …and must be the season the lifecycle would decide on right now.
  const decidedSeason = resolveLifecycleSeason(allSeasons);
  if (!decidedSeason || decidedSeason.id !== activeSeason.id) {
    return { ok: false, error: "season_mismatch" };
  }

  const existing = await getPlayoffBracket(activeSeason.id).catch(() => null);
  if (existing) return { ok: false, error: "already_advanced" };

  const fixtures = await listFixturesBySeason(activeSeason.id).catch(() => []);
  const regular = fixtures.filter((f) => f.stage !== "playoff");
  const regularComplete =
    regular.length === 0 ||
    regular.every((f) => f.status === "final" || f.status === "cancelled");
  if (!regularComplete) {
    return { ok: false, error: "regular_season_incomplete" };
  }

  const size = activeSeason.playoffTeams ?? 0;
  if (!canStartPlayoffs(size)) {
    return { ok: false, error: "invalid_playoff_team_count" };
  }

  try {
    const res = await generatePlayoffBracket({
      seasonId: activeSeason.id,
      size,
      actorUserId: userId,
      divisionWinnersQualify: activeSeason.divisionWinnersQualify,
      format: activeSeason.playoffFormat ?? undefined,
    });
    revalidatePlayoffPaths(input.leagueId);
    return { ok: true, ...res };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: friendlyError(message) };
  }
}
