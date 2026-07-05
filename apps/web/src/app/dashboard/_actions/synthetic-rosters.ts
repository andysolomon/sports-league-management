"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { syntheticRostersV1 } from "@/lib/flags";
import { canManageTeam } from "@/lib/authorization";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import {
  getPlayersByTeam,
  getPlayers,
  getTeamsByLeague,
  getTeamLeagueId,
  getLeagueOrgId,
  getSeasons,
  listFixturesBySeason,
  bulkCreatePlayers,
  clearSyntheticPlayers,
  ingestPlayerAttributesBatch,
} from "@/lib/data-api";
import {
  generateSyntheticRoster,
  seedFromString,
} from "@/lib/synthetic-roster";
import { generateSyntheticAttributes } from "@/lib/synthetic-attributes";
import { isSeasonStarted } from "@/lib/season-started";

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
type AttributeResult =
  | { ok: true; rated: number }
  | { ok: false; error: string };
type LeagueAttributeResult =
  | { ok: true; teams: number; rated: number }
  | { ok: false; error: string };

function existingJerseys(players: { jerseyNumber: number | null }[]): number[] {
  return players.map((p) => p.jerseyNumber).filter((n): n is number => n != null);
}

/** Active season for a league (the season attributes attach to), or null if
 *  the league has no seasons. Prefers the explicitly-active one. */
async function resolveActiveSeasonId(leagueId: string): Promise<string | null> {
  const seasons = await getSeasons([leagueId]).catch(() => []);
  if (seasons.length === 0) return null;
  const active = seasons.find((s) => s.status === "active") ?? seasons[0];
  return active.id;
}

/** Block roster/ratings generation once the active season has started. */
async function assertSeasonNotStarted(
  leagueId: string,
): Promise<{ ok: true } | { ok: false; error: "season_started" }> {
  const seasons = await getSeasons([leagueId]).catch(() => []);
  if (seasons.length === 0) return { ok: true };
  const active = seasons.find((s) => s.status === "active") ?? seasons[0];
  const fixtures = await listFixturesBySeason(active.id).catch(() => []);
  if (isSeasonStarted(active, fixtures)) {
    return { ok: false, error: "season_started" };
  }
  return { ok: true };
}

async function leaguePlayerNames(
  leagueId: string,
  orgContext: Awaited<ReturnType<typeof resolveOrgContext>>,
): Promise<string[]> {
  if (!orgContext.visibleLeagueIds.includes(leagueId)) return [];
  const players = await getPlayers([leagueId]).catch(() => []);
  return players.map((p) => p.name);
}

/** Build attribute-snapshot rows for a team's players (seeded per player so
 *  re-running yields stable ratings). */
function buildAttributeRows(
  players: { id: string; position: string }[],
): {
  playerId: string;
  positionGroup: string;
  attributesJson: string;
  weightedOverall: number | null;
}[] {
  return players.map((p) => {
    const snapshot = generateSyntheticAttributes({
      position: p.position,
      seed: seedFromString(p.id),
    });
    return {
      playerId: p.id,
      positionGroup: snapshot.positionGroup,
      attributesJson: JSON.stringify(snapshot.attributes),
      weightedOverall: snapshot.weightedOverall,
    };
  });
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

  const leagueId = await getTeamLeagueId(input.teamId);
  const seasonGuard = await assertSeasonNotStarted(leagueId);
  if (!seasonGuard.ok) return seasonGuard;

  const target = Math.max(1, Math.min(input.count ?? DEFAULT_ROSTER_SIZE, MAX_ROSTER_SIZE));
  const orgContext = await resolveOrgContext(userId);
  const existing = await getPlayersByTeam(input.teamId, orgContext).catch(() => []);
  const toCreate = Math.max(0, target - existing.length);
  if (toCreate === 0) return { ok: true, created: 0 };

  const excludeNames = await leaguePlayerNames(leagueId, orgContext);
  const players = generateSyntheticRoster({
    count: toCreate,
    excludeJerseys: existingJerseys(existing),
    excludeNames,
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

  const seasonGuard = await assertSeasonNotStarted(input.leagueId);
  if (!seasonGuard.ok) return seasonGuard;

  const target = Math.max(1, Math.min(input.perTeam ?? DEFAULT_ROSTER_SIZE, MAX_ROSTER_SIZE));
  const orgContext = await resolveOrgContext(userId);
  const teams = await getTeamsByLeague(input.leagueId, orgContext).catch(() => []);
  const excludeNames = await leaguePlayerNames(input.leagueId, orgContext);

  let created = 0;
  let touched = 0;
  const usedNames = new Set(excludeNames);
  try {
    for (const team of teams) {
      const existing = await getPlayersByTeam(team.id, orgContext).catch(() => []);
      const toCreate = Math.max(0, target - existing.length);
      if (toCreate === 0) continue;
      const players = generateSyntheticRoster({
        count: toCreate,
        excludeJerseys: existingJerseys(existing),
        excludeNames: Array.from(usedNames),
        seed: seedFromString(team.id),
      });
      for (const p of players) usedNames.add(p.name);
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

// --- Clear synthetic players (delete generator-created test players only) ---

export async function clearTeamSyntheticAction(input: {
  teamId: string;
}): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  if (!(await syntheticRostersV1())) return { ok: false, error: "flag_disabled" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }
  try {
    const { deleted } = await clearSyntheticPlayers(input.teamId);
    revalidatePath(`/dashboard/teams/${input.teamId}`);
    return { ok: true, deleted };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function clearLeagueSyntheticAction(input: {
  leagueId: string;
}): Promise<
  { ok: true; teams: number; deleted: number } | { ok: false; error: string }
> {
  if (!(await syntheticRostersV1())) return { ok: false, error: "flag_disabled" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  const orgId = await getLeagueOrgId(input.leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  if (!canManageOrgSettings(role)) return { ok: false, error: "not_authorized" };

  const orgContext = await resolveOrgContext(userId);
  const teams = await getTeamsByLeague(input.leagueId, orgContext).catch(() => []);
  let deleted = 0;
  let touched = 0;
  try {
    for (const team of teams) {
      const res = await clearSyntheticPlayers(team.id);
      deleted += res.deleted;
      if (res.deleted > 0) touched += 1;
    }
    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    return { ok: true, teams: touched, deleted };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Generate synthetic attributes (ratings) for existing players ---
// Separate from roster generation so it works on any roster (generated or
// real test data): gives players Madden-style ratings for the SPRT/Madden
// rating, development, and ranking surfaces. Attached to the league's active
// season. Idempotent — re-running overwrites the same per-player snapshot.

export async function generateTeamAttributesAction(input: {
  teamId: string;
}): Promise<AttributeResult> {
  if (!(await syntheticRostersV1())) return { ok: false, error: "flag_disabled" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  if (!(await canManageTeam(input.teamId, userId))) {
    return { ok: false, error: "not_authorized" };
  }

  const leagueId = await getTeamLeagueId(input.teamId);
  const seasonGuard = await assertSeasonNotStarted(leagueId);
  if (!seasonGuard.ok) return seasonGuard;

  const seasonId = await resolveActiveSeasonId(leagueId);
  if (!seasonId) return { ok: false, error: "no_season" };

  const orgContext = await resolveOrgContext(userId);
  const players = await getPlayersByTeam(input.teamId, orgContext).catch(() => []);
  if (players.length === 0) return { ok: true, rated: 0 };

  try {
    const rows = buildAttributeRows(players);
    const { created, updated } = await ingestPlayerAttributesBatch(seasonId, rows);
    revalidatePath(`/dashboard/teams/${input.teamId}`);
    return { ok: true, rated: created + updated };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function generateLeagueAttributesAction(input: {
  leagueId: string;
}): Promise<LeagueAttributeResult> {
  if (!(await syntheticRostersV1())) return { ok: false, error: "flag_disabled" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };
  const orgId = await getLeagueOrgId(input.leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  if (!canManageOrgSettings(role)) return { ok: false, error: "not_authorized" };

  const seasonGuard = await assertSeasonNotStarted(input.leagueId);
  if (!seasonGuard.ok) return seasonGuard;

  const seasonId = await resolveActiveSeasonId(input.leagueId);
  if (!seasonId) return { ok: false, error: "no_season" };

  const orgContext = await resolveOrgContext(userId);
  const teams = await getTeamsByLeague(input.leagueId, orgContext).catch(() => []);

  let rated = 0;
  let touched = 0;
  try {
    for (const team of teams) {
      const players = await getPlayersByTeam(team.id, orgContext).catch(() => []);
      if (players.length === 0) continue;
      const rows = buildAttributeRows(players);
      const { created, updated } = await ingestPlayerAttributesBatch(seasonId, rows);
      rated += created + updated;
      touched += 1;
    }
    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    return { ok: true, teams: touched, rated };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
