"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { schedulesStandingsV1 } from "@/lib/flags";
import {
  createFixture,
  deleteFixture,
  generateSeasonSchedule,
  getLeague,
  getLeagueOrgId,
  recordGameResult,
} from "@/lib/data-api";
import { resolveOrgRole, resolveOrgContext } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";
import {
  trackFixtureCreated,
  trackResultRecorded,
} from "@/lib/analytics";

interface CreateFixtureActionInput {
  leagueId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string | null;
  week: number | null;
  venue: string | null;
}

/*
 * Auth chain shared by the three schedule actions:
 *   1. flag enabled
 *   2. Clerk session present
 *   3. league visible to the user (resolveOrgContext)
 *   4. caller can manage rosters (admin or coach) of the league's org —
 *      coaches run schedules/results (WSM-000121)
 */
async function authorizeManagerAction(
  leagueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const enabled = await schedulesStandingsV1();
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

export async function createFixtureAction(
  input: CreateFixtureActionInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  if (input.homeTeamId === input.awayTeamId) {
    return { ok: false, error: "home_and_away_must_differ" };
  }

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  try {
    const fixture = await createFixture({
      seasonId: input.seasonId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      scheduledAt: input.scheduledAt,
      week: input.week,
      venue: input.venue,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}/schedule`);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/standings`);
    void trackFixtureCreated({
      leagueId: input.leagueId,
      seasonId: input.seasonId,
    });
    return { ok: true, id: fixture.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/*
 * Generate a single round-robin schedule for the league's active season
 * (WSM-000153). The mutation refuses to overwrite a slate that already has
 * recorded results / live state; that surfaces here as `needsConfirm` so the
 * UI can re-call with `confirm: true`.
 */
export async function generateScheduleAction(input: {
  leagueId: string;
  seasonId: string;
  confirm?: boolean;
}): Promise<
  | { ok: true; created: number; weeks: number; teamCount: number }
  | { ok: false; needsConfirm: true }
  | { ok: false; error: string }
> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  try {
    const res = await generateSeasonSchedule({
      seasonId: input.seasonId,
      actorUserId: userId,
      confirm: input.confirm,
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}/schedule`);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/standings`);
    return { ok: true, ...res };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("schedule_has_results")) {
      return { ok: false, needsConfirm: true };
    }
    return { ok: false, error: message };
  }
}

interface RecordResultActionInput {
  leagueId: string;
  fixtureId: string;
  homeScore: number;
  awayScore: number;
}

export async function recordGameResultAction(
  input: RecordResultActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  if (
    !Number.isFinite(input.homeScore) ||
    !Number.isFinite(input.awayScore) ||
    input.homeScore < 0 ||
    input.awayScore < 0
  ) {
    return { ok: false, error: "invalid_score" };
  }

  try {
    await recordGameResult({
      fixtureId: input.fixtureId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      actorUserId: userId,
    });
    revalidatePath(`/dashboard/leagues/${input.leagueId}/schedule`);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/standings`);
    revalidatePath(`/leagues/${input.leagueId}/standings`);
    void trackResultRecorded({
      leagueId: input.leagueId,
      fixtureId: input.fixtureId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

interface DeleteFixtureActionInput {
  leagueId: string;
  fixtureId: string;
}

export async function deleteFixtureAction(
  input: DeleteFixtureActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await authorizeManagerAction(input.leagueId);
  if (!guard.ok) return guard;

  try {
    await deleteFixture(input.fixtureId);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/schedule`);
    revalidatePath(`/dashboard/leagues/${input.leagueId}/standings`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
