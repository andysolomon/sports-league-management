"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { PlayerGameStatLineSchema } from "@sports-management/api-contracts";
import type { PlayerGameStatLine } from "@sports-management/shared-types";
import { statKeepingV1 } from "@/lib/flags";
import {
  getFixture,
  upsertPlayerGameStats,
  deletePlayerGameStats,
} from "@/lib/data-api";
import { canManageTeam } from "@/lib/authorization";

/*
 * Box-score entry actions (WSM-000112). Authz: a coach/admin of the team
 * (canManageTeam — league OR owner org) may enter their team's stats; this
 * matches the stat-keeper persona and the existing "coaches run game ops"
 * stance (WSM-000121). The team must actually be in the fixture (cross-fixture
 * guard), and the line is validated at the edge before persisting.
 */

interface SaveInput {
  teamId: string;
  fixtureId: string;
  playerId: string;
  stats: PlayerGameStatLine;
}

type Result = { ok: true } | { ok: false; error: string };

async function authorize(
  teamId: string,
  fixtureId: string,
): Promise<
  { ok: true; userId: string; seasonId: string } | { ok: false; error: string }
> {
  const enabled = await statKeepingV1();
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
  return { ok: true, userId, seasonId: fixture.seasonId };
}

export async function savePlayerGameStatsAction(
  input: SaveInput,
): Promise<Result> {
  const guard = await authorize(input.teamId, input.fixtureId);
  if (!guard.ok) return guard;

  const parsed = PlayerGameStatLineSchema.safeParse(input.stats);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "invalid_stats" };
  }

  try {
    await upsertPlayerGameStats({
      fixtureId: input.fixtureId,
      playerId: input.playerId,
      teamId: input.teamId,
      seasonId: guard.seasonId,
      stats: parsed.data,
      actorUserId: guard.userId,
    });
    revalidatePath(
      `/dashboard/teams/${input.teamId}/games/${input.fixtureId}/stats`,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearPlayerGameStatsAction(input: {
  teamId: string;
  fixtureId: string;
  playerId: string;
}): Promise<Result> {
  const guard = await authorize(input.teamId, input.fixtureId);
  if (!guard.ok) return guard;

  try {
    await deletePlayerGameStats(input.fixtureId, input.playerId);
    revalidatePath(
      `/dashboard/teams/${input.teamId}/games/${input.fixtureId}/stats`,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
