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
  beginSeasonRollover,
  advanceSeasonRollover,
  rolloverGraduateAndAdvancePlayers,
  listSeasonPlayerAttributes,
  ingestPlayerAttributesBatch,
  copySeasonRosters,
  removePlayersFromSeasonRoster,
  bulkCreatePlayers,
} from "@/lib/data-api";
import { activeNonGraduatedNames } from "@/lib/dynasty";
import { computeProgressedAttributes } from "@/lib/dynasty-progression";
import { resolveLifecycleSeason } from "@/lib/season-view";
import {
  generateSyntheticRoster,
  seedFromString,
} from "@/lib/synthetic-roster";
import { generateSyntheticAttributes } from "@/lib/synthetic-attributes";
import type { PlayerDto } from "@sports-management/shared-types";

const DEFAULT_ROSTER_SIZE = 48;
const MAX_ROSTER_SIZE = 60;
const ROLLOVER_STAGES = [
  "target_created",
  "players_progressed",
  "attributes_copied",
  "rosters_copied",
  "freshmen_created",
  "completed",
] as const;

function hasReachedRolloverStage(stage: string, expected: string): boolean {
  return ROLLOVER_STAGES.indexOf(stage as (typeof ROLLOVER_STAGES)[number]) >=
    ROLLOVER_STAGES.indexOf(expected as (typeof ROLLOVER_STAGES)[number]);
}

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
  freshmenToPool?: boolean;
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
  const activeSeason = resolveLifecycleSeason(
    seasons.filter((season) => season.status === "completed"),
  );
  if (!activeSeason) return { ok: false, error: "no_completed_season" };

  try {
    const rollover = await beginSeasonRollover({
      sourceSeasonId: activeSeason.id,
    });
    const nextSeasonId = rollover.targetSeasonId;
    let stage = rollover.stage;
    let graduatedPlayerIds = rollover.graduatedPlayerIds;
    let advancedPlayerIds = rollover.advancedPlayerIds;

    // A target that was completed outside this action atomically finalizes its
    // claim in beginSeasonRollover. Never reopen its progression on retry.
    if (rollover.status === "completed" || stage === "completed") {
      return {
        ok: true,
        seasonId: nextSeasonId,
        graduated: graduatedPlayerIds.length,
        advanced: advancedPlayerIds.length,
        progressed: 0,
        freshmen: 0,
      };
    }

    if (!hasReachedRolloverStage(stage, "players_progressed")) {
      const progressedPlayers = await rolloverGraduateAndAdvancePlayers({
        leagueId: input.leagueId,
        seasonId: activeSeason.id,
        rolloverId: rollover.rolloverId,
      });
      graduatedPlayerIds = progressedPlayers.graduatedPlayerIds;
      advancedPlayerIds = progressedPlayers.advancedPlayerIds;
      stage = "players_progressed";
    }

    const leaguePlayers = await getPlayers([input.leagueId]).catch(() => []);

    let progressed = 0;
    if (!hasReachedRolloverStage(stage, "attributes_copied")) {
      const priorAttributes = await listSeasonPlayerAttributes(activeSeason.id);
      const attrByPlayer = new Map(priorAttributes.map((r) => [r.playerId, r]));
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
              newSeasonId: nextSeasonId,
              position: player.position,
              previousGrade,
              previousAttributes: prior.attributes,
              positionGroup: prior.positionGroup,
            })
          : generateSyntheticAttributes({
              position: player.position,
              seed: seedFromString(`${playerId}:${nextSeasonId}`),
            });

        progressionRows.push({
          playerId,
          positionGroup: snapshot.positionGroup,
          attributesJson: JSON.stringify(snapshot.attributes),
          weightedOverall: snapshot.weightedOverall,
        });
      }

      if (progressionRows.length > 0) {
        const res = await ingestPlayerAttributesBatch(nextSeasonId, progressionRows);
        progressed = res.created + res.updated;
      }
      const checkpoint = await advanceSeasonRollover({
        rolloverId: rollover.rolloverId,
        stage: "attributes_copied",
      });
      stage = checkpoint.stage;
    }

    if (!hasReachedRolloverStage(stage, "rosters_copied")) {
      await copySeasonRosters({
        targetSeasonId: nextSeasonId,
        sourceSeasonId: activeSeason.id,
        actorUserId: userId,
        confirm: true,
      });

      if (graduatedPlayerIds.length > 0) {
        await removePlayersFromSeasonRoster({
          leagueId: input.leagueId,
          seasonId: nextSeasonId,
          playerIds: graduatedPlayerIds,
        });
      }
      const checkpoint = await advanceSeasonRollover({
        rolloverId: rollover.rolloverId,
        stage: "rosters_copied",
      });
      stage = checkpoint.stage;
    }

    let freshmen = 0;
    if (!hasReachedRolloverStage(stage, "freshmen_created")) {
      const teams = await getTeamsByLeague(input.leagueId, orgContext).catch(
        () => [],
      );
      const excludeNames = activeNonGraduatedNames(leaguePlayers);
      const usedNames = new Set(excludeNames);
      const target = Math.max(
        1,
        Math.min(DEFAULT_ROSTER_SIZE, MAX_ROSTER_SIZE),
      );

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
          seed: seedFromString(`${team.id}:${nextSeasonId}`),
        });
        const players = input.freshmenToPool
          ? batch.map((p) => ({ ...p, status: "free_agent" }))
          : batch;
        for (const p of players) usedNames.add(p.name);
        const { created } = await bulkCreatePlayers(team.id, players);
        freshmen += created;
      }
      const checkpoint = await advanceSeasonRollover({
        rolloverId: rollover.rolloverId,
        stage: "freshmen_created",
      });
      stage = checkpoint.stage;
    }

    await advanceSeasonRollover({
      rolloverId: rollover.rolloverId,
      stage: "completed",
    });

    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    revalidatePath("/dashboard/seasons");

    return {
      ok: true,
      seasonId: nextSeasonId,
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
