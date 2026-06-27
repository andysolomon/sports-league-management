"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { syntheticRostersV1 } from "@/lib/flags";
import { canManageTeam } from "@/lib/authorization";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import {
  getPlayersByTeam,
  getTeamsByLeague,
  getLeagueOrgId,
  bulkCreatePlayers,
} from "@/lib/data-api";
import {
  generateSyntheticRoster,
  seedFromString,
} from "@/lib/synthetic-roster";

/*
 * Synthetic-roster generation (WSM-000173) — fills demo/test rosters with fake
 * players. Per team (coach/admin) or league-wide (admin only). "Fill to count":
 * generates only `count - existing` players, so re-running tops up rather than
 * piling on. Gated by the syntheticRostersV1 flag. Players are clearly fake
 * (the generator never uses real data).
 */

const DEFAULT_ROSTER_SIZE = 48;
const MAX_ROSTER_SIZE = 60;

type TeamResult = { ok: true; created: number } | { ok: false; error: string };
type LeagueResult =
  | { ok: true; teams: number; created: number }
  | { ok: false; error: string };

function existingJerseys(players: { jerseyNumber: number | null }[]): number[] {
  return players.map((p) => p.jerseyNumber).filter((n): n is number => n != null);
}

export async function generateTeamRosterAction(input: {
  teamId: string;
  count?: number;
}): Promise<TeamResult> {
  if (!(await syntheticRostersV1())) return { ok: false, error: "flag_disabled" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }

  const target = Math.max(1, Math.min(input.count ?? DEFAULT_ROSTER_SIZE, MAX_ROSTER_SIZE));
  const orgContext = await resolveOrgContext(userId);
  const existing = await getPlayersByTeam(input.teamId, orgContext).catch(() => []);
  const toCreate = Math.max(0, target - existing.length);
  if (toCreate === 0) return { ok: true, created: 0 };

  const players = generateSyntheticRoster({
    count: toCreate,
    excludeJerseys: existingJerseys(existing),
    seed: seedFromString(input.teamId) + existing.length,
  });
  try {
    const { created } = await bulkCreatePlayers(input.teamId, players);
    revalidatePath(`/dashboard/teams/${input.teamId}`);
    return { ok: true, created };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function generateLeagueRostersAction(input: {
  leagueId: string;
  perTeam?: number;
}): Promise<LeagueResult> {
  if (!(await syntheticRostersV1())) return { ok: false, error: "flag_disabled" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  // League-wide generation is an admin-only operation.
  const orgId = await getLeagueOrgId(input.leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  if (!canManageOrgSettings(role)) return { ok: false, error: "not_authorized" };

  const target = Math.max(1, Math.min(input.perTeam ?? DEFAULT_ROSTER_SIZE, MAX_ROSTER_SIZE));
  const orgContext = await resolveOrgContext(userId);
  const teams = await getTeamsByLeague(input.leagueId, orgContext).catch(() => []);

  let created = 0;
  let touched = 0;
  try {
    for (const team of teams) {
      const existing = await getPlayersByTeam(team.id, orgContext).catch(() => []);
      const toCreate = Math.max(0, target - existing.length);
      if (toCreate === 0) continue;
      const players = generateSyntheticRoster({
        count: toCreate,
        excludeJerseys: existingJerseys(existing),
        seed: seedFromString(team.id),
      });
      const res = await bulkCreatePlayers(team.id, players);
      created += res.created;
      touched += 1;
    }
    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    return { ok: true, teams: touched, created };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
