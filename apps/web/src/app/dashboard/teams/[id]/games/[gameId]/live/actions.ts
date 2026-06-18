"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { liveScoringV1 } from "@/lib/flags";
import {
  getFixture,
  startLiveGame,
  addLiveScore,
  updateLiveState,
  endLiveGame,
  type LiveGameStateDto,
} from "@/lib/data-api";
import { canManageTeam } from "@/lib/authorization";

/*
 * Live-scoreboard operator actions (WSM-000152, keystone v3). Same authz stance
 * as box-score entry (stats/actions.ts): a coach/admin of the team
 * (canManageTeam — league OR owner org) drives the running scoreboard. The team
 * must actually be in the fixture (cross-fixture guard), gated behind
 * liveScoringV1. The Convex layer (PR1) validates point values + state
 * transitions; these actions just authorize and forward.
 */

type Result =
  | { ok: true; state: LiveGameStateDto }
  | { ok: false; error: string };

async function authorize(
  teamId: string,
  fixtureId: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const enabled = await liveScoringV1();
  if (!enabled) return { ok: false, error: "flag_disabled" };

  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const fixture = await getFixture(fixtureId);
  if (!fixture) return { ok: false, error: "fixture_not_found" };
  if (fixture.homeTeamId !== teamId && fixture.awayTeamId !== teamId) {
    return { ok: false, error: "team_not_in_fixture" };
  }

  if (!(await canManageTeam(teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }
  return { ok: true, userId };
}

function revalidate(teamId: string, fixtureId: string): void {
  revalidatePath(`/dashboard/teams/${teamId}/games/${fixtureId}/live`);
}

export async function startLiveGameAction(input: {
  teamId: string;
  fixtureId: string;
}): Promise<Result> {
  const guard = await authorize(input.teamId, input.fixtureId);
  if (!guard.ok) return guard;
  try {
    const state = await startLiveGame(input.fixtureId, guard.userId);
    revalidate(input.teamId, input.fixtureId);
    return { ok: true, state };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function addLiveScoreAction(input: {
  teamId: string;
  fixtureId: string;
  team: "home" | "away";
  points: number;
}): Promise<Result> {
  const guard = await authorize(input.teamId, input.fixtureId);
  if (!guard.ok) return guard;
  try {
    const state = await addLiveScore(input.fixtureId, input.team, input.points);
    revalidate(input.teamId, input.fixtureId);
    return { ok: true, state };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateLiveStateAction(input: {
  teamId: string;
  fixtureId: string;
  patch: { period?: number; clock?: string | null; status?: string };
}): Promise<Result> {
  const guard = await authorize(input.teamId, input.fixtureId);
  if (!guard.ok) return guard;
  try {
    const state = await updateLiveState(input.fixtureId, input.patch);
    revalidate(input.teamId, input.fixtureId);
    return { ok: true, state };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function endLiveGameAction(input: {
  teamId: string;
  fixtureId: string;
}): Promise<Result> {
  const guard = await authorize(input.teamId, input.fixtureId);
  if (!guard.ok) return guard;
  try {
    const state = await endLiveGame(input.fixtureId, guard.userId);
    revalidate(input.teamId, input.fixtureId);
    return { ok: true, state };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
