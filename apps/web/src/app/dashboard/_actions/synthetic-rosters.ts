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
import { resolveLifecycleSeason } from "@/lib/season-view";
import { DEFAULT_TARGET_ROSTER_SIZE } from "@/lib/offseason-activate";
import {
  activeRosterCountByTeam,
  buildLeagueRosterDeficitProjection,
  type UndersizedTeamWithDeficit,
} from "@/lib/roster-deficit";

/*
 * Synthetic-roster generation (WSM-000173) — fills demo/test rosters with fake
 * players. Per team (coach/admin) or league-wide (admin only). "Fill to count":
 * generates only `count - existing` players, so re-running tops up rather than
 * piling on. Gated by the syntheticRostersV1 flag. Players are clearly fake
 * (the generator never uses real data).
 */

const DEFAULT_ROSTER_SIZE = DEFAULT_TARGET_ROSTER_SIZE;
const MAX_ROSTER_SIZE = 60;

type DeficitProjectionResult =
  | { ok: true; target: number; teams: UndersizedTeamWithDeficit[] }
  | { ok: false; error: string };

type FillDeficientResult =
  | {
      ok: true;
      teamsFilled: number;
      created: number;
      fullTeamsUnchanged: number;
    }
  | { ok: false; error: string };

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
  return resolveLifecycleSeason(seasons)?.id ?? null;
}

/** Block roster/ratings generation once the active season has started. */
async function assertSeasonNotStarted(
  leagueId: string,
): Promise<{ ok: true } | { ok: false; error: "season_started" }> {
  const seasons = await getSeasons([leagueId]).catch(() => []);
  if (seasons.length === 0) return { ok: true };
  const active = resolveLifecycleSeason(seasons);
  if (!active) return { ok: true };
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

/** Bounded league roster-deficit projection — deficient teams only (WSM-000242). */
export async function getLeagueRosterDeficitAction(input: {
  leagueId: string;
}): Promise<DeficitProjectionResult> {
  if (!(await syntheticRostersV1())) return { ok: false, error: "flag_disabled" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgContext = await resolveOrgContext(userId);
  if (!orgContext.visibleLeagueIds.includes(input.leagueId)) {
    return { ok: false, error: "not_authorized" };
  }

  const teams = await getTeamsByLeague(input.leagueId, orgContext).catch(() => []);
  const players = await getPlayers([input.leagueId]).catch(() => []);
  const countByTeam = activeRosterCountByTeam(players);
  return { ok: true, ...buildLeagueRosterDeficitProjection(teams, countByTeam) };
}

async function fillTeamsToTarget(
  teamIds: string[],
  leagueId: string,
  orgContext: Awaited<ReturnType<typeof resolveOrgContext>>,
  target: number,
): Promise<{ teamsFilled: number; created: number }> {
  const excludeNames = await leaguePlayerNames(leagueId, orgContext);
  const usedNames = new Set(excludeNames);
  let created = 0;
  let teamsFilled = 0;

  for (const teamId of teamIds) {
    const existing = await getPlayersByTeam(teamId, orgContext).catch(() => []);
    const toCreate = Math.max(0, target - existing.length);
    if (toCreate === 0) continue;
    const players = generateSyntheticRoster({
      count: toCreate,
      excludeJerseys: existingJerseys(existing),
      excludeNames: Array.from(usedNames),
      seed: seedFromString(teamId) + existing.length,
    });
    for (const player of players) usedNames.add(player.name);
    const res = await bulkCreatePlayers(teamId, players);
    created += res.created;
    teamsFilled += 1;
  }

  return { teamsFilled, created };
}

/** Auto-fill only deficient teams — admin fills all; coach fills managed teams (WSM-000242). */
export async function fillDeficientRostersAction(input: {
  leagueId: string;
}): Promise<FillDeficientResult> {
  if (!(await syntheticRostersV1())) return { ok: false, error: "flag_disabled" };
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const seasonGuard = await assertSeasonNotStarted(input.leagueId);
  if (!seasonGuard.ok) return seasonGuard;

  const orgId = await getLeagueOrgId(input.leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  const isAdmin = canManageOrgSettings(role);

  const orgContext = await resolveOrgContext(userId);
  if (!orgContext.visibleLeagueIds.includes(input.leagueId)) {
    return { ok: false, error: "not_authorized" };
  }

  const teams = await getTeamsByLeague(input.leagueId, orgContext).catch(() => []);
  const players = await getPlayers([input.leagueId]).catch(() => []);
  const countByTeam = activeRosterCountByTeam(players);
  const projection = buildLeagueRosterDeficitProjection(teams, countByTeam);
  const fullTeamIds = teams
    .filter((team) => (countByTeam.get(team.id) ?? 0) >= projection.target)
    .map((team) => team.id);
  const fullTeamPlayerIdsBefore = new Map<string, string[]>();
  for (const teamId of fullTeamIds) {
    const roster = await getPlayersByTeam(teamId, orgContext).catch(() => []);
    fullTeamPlayerIdsBefore.set(
      teamId,
      roster.map((player) => player.id).sort(),
    );
  }

  let teamIdsToFill: string[];
  if (isAdmin) {
    teamIdsToFill = projection.teams.map((team) => team.id);
  } else {
    const manageable: string[] = [];
    for (const team of projection.teams) {
      if (await canManageTeam(team.id, userId)) {
        manageable.push(team.id);
      }
    }
    if (manageable.length === 0) {
      return { ok: false, error: "not_authorized" };
    }
    teamIdsToFill = manageable;
  }

  try {
    const { teamsFilled, created } = await fillTeamsToTarget(
      teamIdsToFill,
      input.leagueId,
      orgContext,
      projection.target,
    );

    for (const teamId of fullTeamIds) {
      const roster = await getPlayersByTeam(teamId, orgContext).catch(() => []);
      const afterIds = roster.map((player) => player.id).sort();
      const beforeIds = fullTeamPlayerIdsBefore.get(teamId) ?? [];
      if (afterIds.join(",") !== beforeIds.join(",")) {
        throw new Error("full_roster_mutated");
      }
    }

    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    return {
      ok: true,
      teamsFilled,
      created,
      fullTeamsUnchanged: fullTeamIds.length,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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
