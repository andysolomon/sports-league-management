"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageOrgSettings } from "@/lib/permissions";
import {
  getLeagueOrgId,
  getSeasons,
  getTeamsByLeague,
  getPlayersByTeam,
  getPlayers,
  upsertSeason,
  rolloverGraduateAndAdvancePlayers,
  listSeasonPlayerAttributes,
  ingestPlayerAttributesBatch,
  copySeasonRosters,
  removePlayersFromSeasonRoster,
  bulkCreatePlayers,
  listFixturesBySeason,
  getPlayoffBracket,
} from "@/lib/data-api";
import {
  incrementSeasonName,
  isSeasonDecided,
  activeNonGraduatedNames,
} from "@/lib/dynasty";
import { computeProgressedAttributes } from "@/lib/dynasty-progression";
import {
  generateSyntheticRoster,
  seedFromString,
} from "@/lib/synthetic-roster";
import { generateSyntheticAttributes } from "@/lib/synthetic-attributes";
import type { PlayerDto } from "@sports-management/shared-types";

const DEFAULT_ROSTER_SIZE = 48;
const MAX_ROSTER_SIZE = 60;

type RolloverResult =
  | {
      ok: true;
      seasonId: string;
      graduated: number;
      advanced: number;
      progressed: number;
      freshmen: number;
    }
  | { ok: false; error: string };

function existingJerseys(players: { jerseyNumber: number | null }[]): number[] {
  return players.map((p) => p.jerseyNumber).filter((n): n is number => n != null);
}

function activeRosterCount(players: PlayerDto[]): number {
  return players.filter((p) => p.status !== "graduated").length;
}

export async function startNextSeasonAction(input: {
  leagueId: string;
}): Promise<RolloverResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "unauthorized" };

  const orgId = await getLeagueOrgId(input.leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  if (!canManageOrgSettings(role)) return { ok: false, error: "not_authorized" };

  const orgContext = await resolveOrgContext(userId);
  if (!orgContext.visibleLeagueIds.includes(input.leagueId)) {
    return { ok: false, error: "not_authorized" };
  }

  const seasons = await getSeasons([input.leagueId]).catch(() => []);
  const activeSeason = seasons.find((s) => s.status === "active");
  if (!activeSeason) return { ok: false, error: "no_season" };

  if (seasons.some((s) => s.status === "upcoming")) {
    return { ok: false, error: "next_season_exists" };
  }

  const [fixtures, bracket] = await Promise.all([
    listFixturesBySeason(activeSeason.id).catch(() => []),
    getPlayoffBracket(activeSeason.id).catch(() => null),
  ]);
  if (!isSeasonDecided(fixtures, bracket)) {
    return { ok: false, error: "season_not_decided" };
  }

  const nextName = incrementSeasonName(activeSeason.name);

  try {
    const { dto: nextSeason } = await upsertSeason({
      name: nextName,
      leagueId: input.leagueId,
      startDate: activeSeason.startDate,
      endDate: activeSeason.endDate,
      status: "upcoming",
      playoffTeams: activeSeason.playoffTeams ?? undefined,
      playoffFormat: activeSeason.playoffFormat ?? undefined,
      divisionWinnersQualify: activeSeason.divisionWinnersQualify,
    });

    const { graduatedPlayerIds, advancedPlayerIds } =
      await rolloverGraduateAndAdvancePlayers({
        leagueId: input.leagueId,
        seasonId: activeSeason.id,
      });

    const priorAttributes = await listSeasonPlayerAttributes(activeSeason.id);
    const attrByPlayer = new Map(priorAttributes.map((r) => [r.playerId, r]));
    const leaguePlayers = await getPlayers([input.leagueId]).catch(() => []);
    const playerById = new Map(leaguePlayers.map((p) => [p.id, p]));

    const progressionRows: {
      playerId: string;
      positionGroup: string;
      attributesJson: string;
      weightedOverall: number | null;
    }[] = [];

    for (const playerId of advancedPlayerIds) {
      const player = playerById.get(playerId);
      if (!player) continue;
      const prior = attrByPlayer.get(playerId);
      const previousGrade =
        player.grade !== null ? Math.max(9, player.grade - 1) : null;

      const snapshot = prior
        ? computeProgressedAttributes({
            playerId,
            newSeasonId: nextSeason.id,
            position: player.position,
            previousGrade,
            previousAttributes: prior.attributes,
            positionGroup: prior.positionGroup,
          })
        : generateSyntheticAttributes({
            position: player.position,
            seed: seedFromString(`${playerId}:${nextSeason.id}`),
          });

      progressionRows.push({
        playerId,
        positionGroup: snapshot.positionGroup,
        attributesJson: JSON.stringify(snapshot.attributes),
        weightedOverall: snapshot.weightedOverall,
      });
    }

    let progressed = 0;
    if (progressionRows.length > 0) {
      const res = await ingestPlayerAttributesBatch(nextSeason.id, progressionRows);
      progressed = res.created + res.updated;
    }

    await copySeasonRosters({
      targetSeasonId: nextSeason.id,
      sourceSeasonId: activeSeason.id,
      actorUserId: userId,
      confirm: true,
    });

    if (graduatedPlayerIds.length > 0) {
      await removePlayersFromSeasonRoster({
        leagueId: input.leagueId,
        seasonId: nextSeason.id,
        playerIds: graduatedPlayerIds,
      });
    }

    const teams = await getTeamsByLeague(input.leagueId, orgContext).catch(
      () => [],
    );
    const excludeNames = activeNonGraduatedNames(leaguePlayers);
    const usedNames = new Set(excludeNames);
    const target = Math.max(
      1,
      Math.min(DEFAULT_ROSTER_SIZE, MAX_ROSTER_SIZE),
    );
    let freshmen = 0;

    for (const team of teams) {
      const existing = await getPlayersByTeam(team.id, orgContext).catch(
        () => [],
      );
      const toCreate = Math.max(0, target - activeRosterCount(existing));
      if (toCreate === 0) continue;

      const batch = generateSyntheticRoster({
        count: toCreate,
        grade: 9,
        excludeJerseys: existingJerseys(existing),
        excludeNames: Array.from(usedNames),
        seed: seedFromString(`${team.id}:${nextSeason.id}`),
      });
      for (const p of batch) usedNames.add(p.name);
      const { created } = await bulkCreatePlayers(team.id, batch);
      freshmen += created;
    }

    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    revalidatePath("/dashboard/seasons");

    return {
      ok: true,
      seasonId: nextSeason.id,
      graduated: graduatedPlayerIds.length,
      advanced: advancedPlayerIds.length,
      progressed,
      freshmen,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
