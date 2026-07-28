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
  claimSeasonRolloverStage,
  releaseSeasonRolloverStage,
  rolloverGraduateAndAdvancePlayers,
  listSeasonPlayerAttributes,
  ingestPlayerAttributesBatch,
  copySeasonRosters,
  removePlayersFromSeasonRoster,
  createRolloverFreshmenForTeam,
  healSeasonInjuries,
  createProspectClass,
  getDynastyConfig,
} from "@/lib/data-api";
import { activeNonGraduatedNames } from "@/lib/dynasty";
import {
  generateProspectClass,
  prospectClassSize,
} from "@/lib/dynasty/prospects";
import { computeProgressedAttributes } from "@/lib/dynasty-progression";
import { resolveLifecycleSeason } from "@/lib/season-view";
import {
  generateSyntheticRoster,
  seedFromString,
} from "@/lib/synthetic-roster";
import { generateSyntheticAttributes } from "@/lib/synthetic-attributes";
import type { RolloverOperationSummary } from "@/lib/rollover-summary";
import type { PlayerDto } from "@sports-management/shared-types";

const DEFAULT_ROSTER_SIZE = 48;
const MAX_ROSTER_SIZE = 60;
const ROLLOVER_STAGE_LEASE_MS = 60_000;
const ROLLOVER_STAGE_WAIT_MS = 200;
const ROLLOVER_STAGE_WAIT_ATTEMPTS = 300;
const ROLLOVER_STAGES = [
  "target_created",
  "players_progressed",
  "attributes_copied",
  "rosters_copied",
  "freshmen_created",
  "injuries_healed",
  "prospects_generated",
  "completed",
] as const;

function hasReachedRolloverStage(stage: string, expected: string): boolean {
  return (
    ROLLOVER_STAGES.indexOf(stage as (typeof ROLLOVER_STAGES)[number]) >=
    ROLLOVER_STAGES.indexOf(expected as (typeof ROLLOVER_STAGES)[number])
  );
}

function createRolloverSummary(input: {
  sourceSeason: { id: string; name: string };
  targetSeason: { id: string; name: string };
  graduated: number;
  advanced: number;
  freshmenToPool: boolean;
}): RolloverOperationSummary {
  return {
    sourceSeason: input.sourceSeason,
    targetSeason: input.targetSeason,
    graduation: { players: input.graduated },
    advancement: { players: input.advanced },
    progression: { snapshots: 0 },
    carryover: {
      copiedAssignments: 0,
      copiedDepthEntries: 0,
      removedAssignments: 0,
      removedDepthEntries: 0,
    },
    recruiting: { freshmen: 0, toPool: input.freshmenToPool, prospects: 0 },
    healing: { injuries: 0 },
  };
}

function parseRolloverSummary(
  summaryJson: string | null | undefined,
  fallback: RolloverOperationSummary,
): RolloverOperationSummary {
  if (!summaryJson) return fallback;
  try {
    const parsed = JSON.parse(summaryJson) as Partial<RolloverOperationSummary>;
    return {
      sourceSeason: parsed.sourceSeason ?? fallback.sourceSeason,
      targetSeason: parsed.targetSeason ?? fallback.targetSeason,
      graduation: parsed.graduation ?? fallback.graduation,
      advancement: parsed.advancement ?? fallback.advancement,
      progression: parsed.progression ?? fallback.progression,
      carryover: parsed.carryover ?? fallback.carryover,
      /*
       * MERGED, not substituted. A summary persisted before B3 has a
       * `recruiting` object without `prospects`, and taking it wholesale would
       * hand the renderer a field the type says is always a number — the exact
       * shape of the crash B2 caused with `healing`. Spreading the fallback
       * underneath fills the gap without overwriting what was really recorded.
       */
      recruiting: { ...fallback.recruiting, ...(parsed.recruiting ?? {}) },
      // Summaries persisted before B2 have no `healing` key. Falling back keeps
      // a rollover that started on the old code renderable on the new.
      healing: parsed.healing ?? fallback.healing,
    };
  } catch {
    return fallback;
  }
}

function serializeRolloverSummary(summary: RolloverOperationSummary): string {
  return JSON.stringify(summary);
}

function parseFreshmenProgress(
  progressJson: string | null | undefined,
): Record<string, number> {
  if (!progressJson) return {};
  try {
    const parsed = JSON.parse(progressJson) as Record<string, unknown>;
    const progress: Record<string, number> = {};
    for (const [teamId, count] of Object.entries(parsed)) {
      if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
        progress[teamId] = count;
      }
    }
    return progress;
  } catch {
    return {};
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RolloverResult =
  | {
      ok: true;
      seasonId: string;
      seasonName: string;
      graduated: number;
      advanced: number;
      progressed: number;
      freshmen: number;
      summary: RolloverOperationSummary;
    }
  | { ok: false; error: string };

function existingJerseys(players: { jerseyNumber: number | null }[]): number[] {
  return players
    .map((p) => p.jerseyNumber)
    .filter((n): n is number => n != null);
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
  if (!canManageOrgSettings(role))
    return { ok: false, error: "not_authorized" };

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
    let summary = parseRolloverSummary(
      rollover.summaryJson,
      createRolloverSummary({
        sourceSeason: {
          id: rollover.sourceSeasonId ?? activeSeason.id,
          name: rollover.sourceSeasonName ?? activeSeason.name,
        },
        targetSeason: {
          id: nextSeasonId,
          name: rollover.targetSeasonName ?? "Next season",
        },
        graduated: graduatedPlayerIds.length,
        advanced: advancedPlayerIds.length,
        freshmenToPool: input.freshmenToPool === true,
      }),
    );
    const ownerId = `${userId}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2)}`;

    async function claimStage(targetStage: (typeof ROLLOVER_STAGES)[number]) {
      for (let attempt = 0; attempt < ROLLOVER_STAGE_WAIT_ATTEMPTS; attempt++) {
        const claim = await claimSeasonRolloverStage({
          rolloverId: rollover.rolloverId,
          stage: targetStage,
          ownerId,
          leaseMs: ROLLOVER_STAGE_LEASE_MS,
        });
        stage = claim.stage;
        graduatedPlayerIds = claim.graduatedPlayerIds;
        advancedPlayerIds = claim.advancedPlayerIds;
        summary = parseRolloverSummary(claim.summaryJson, summary);
        if (claim.status === "completed" || stage === "completed") {
          return false;
        }
        if (hasReachedRolloverStage(stage, targetStage)) {
          return false;
        }
        if (claim.acquired) return true;
        await sleep(ROLLOVER_STAGE_WAIT_MS);
      }
      throw new Error("rollover_stage_busy");
    }

    async function releaseClaimedStage(
      targetStage: (typeof ROLLOVER_STAGES)[number],
      err: unknown,
    ) {
      await releaseSeasonRolloverStage({
        rolloverId: rollover.rolloverId,
        stage: targetStage,
        ownerId,
        lastError: err instanceof Error ? err.message : String(err),
      }).catch(() => null);
    }

    if (rollover.status === "completed" || stage === "completed") {
      return {
        ok: true,
        seasonId: nextSeasonId,
        seasonName: summary.targetSeason.name,
        graduated: summary.graduation.players,
        advanced: summary.advancement.players,
        progressed: summary.progression.snapshots,
        freshmen: summary.recruiting.freshmen,
        summary,
      };
    }

    if (!hasReachedRolloverStage(stage, "players_progressed")) {
      const acquired = await claimStage("players_progressed");
      if (acquired) {
        try {
          const progressedPlayers = await rolloverGraduateAndAdvancePlayers({
            leagueId: input.leagueId,
            seasonId: activeSeason.id,
            rolloverId: rollover.rolloverId,
            ownerId,
          });
          graduatedPlayerIds = progressedPlayers.graduatedPlayerIds;
          advancedPlayerIds = progressedPlayers.advancedPlayerIds;
          summary.graduation.players = graduatedPlayerIds.length;
          summary.advancement.players = advancedPlayerIds.length;
          stage = "players_progressed";
        } catch (err) {
          await releaseClaimedStage("players_progressed", err);
          throw err;
        }
      }
    }

    const leaguePlayers = await getPlayers([input.leagueId]).catch(() => []);

    if (!hasReachedRolloverStage(stage, "attributes_copied")) {
      const acquired = await claimStage("attributes_copied");
      if (acquired) {
        try {
          const priorAttributes = await listSeasonPlayerAttributes(activeSeason.id);
          const attrByPlayer = new Map(
            priorAttributes.map((r) => [r.playerId, r]),
          );
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

          let progressed = 0;
          if (progressionRows.length > 0) {
            const res = await ingestPlayerAttributesBatch(
              nextSeasonId,
              progressionRows,
            );
            progressed = res.created + res.updated;
          }
          summary.progression.snapshots = progressed;
          const checkpoint = await advanceSeasonRollover({
            rolloverId: rollover.rolloverId,
            stage: "attributes_copied",
            summaryJson: serializeRolloverSummary(summary),
            ownerId,
          });
          stage = checkpoint.stage;
          summary = parseRolloverSummary(checkpoint.summaryJson, summary);
        } catch (err) {
          await releaseClaimedStage("attributes_copied", err);
          throw err;
        }
      }
    }

    if (!hasReachedRolloverStage(stage, "rosters_copied")) {
      const acquired = await claimStage("rosters_copied");
      if (acquired) {
        try {
          const copied = await copySeasonRosters({
            targetSeasonId: nextSeasonId,
            sourceSeasonId: activeSeason.id,
            actorUserId: userId,
            confirm: true,
          });

          let removed = { removedAssignments: 0, removedDepthEntries: 0 };
          if (graduatedPlayerIds.length > 0) {
            removed = await removePlayersFromSeasonRoster({
              leagueId: input.leagueId,
              seasonId: nextSeasonId,
              playerIds: graduatedPlayerIds,
            });
          }
          summary.carryover = {
            copiedAssignments: copied.copiedAssignments,
            copiedDepthEntries: copied.copiedDepthEntries,
            removedAssignments: removed.removedAssignments,
            removedDepthEntries: removed.removedDepthEntries,
          };
          const checkpoint = await advanceSeasonRollover({
            rolloverId: rollover.rolloverId,
            stage: "rosters_copied",
            summaryJson: serializeRolloverSummary(summary),
            ownerId,
          });
          stage = checkpoint.stage;
          summary = parseRolloverSummary(checkpoint.summaryJson, summary);
        } catch (err) {
          await releaseClaimedStage("rosters_copied", err);
          throw err;
        }
      }
    }

    if (!hasReachedRolloverStage(stage, "freshmen_created")) {
      const acquired = await claimStage("freshmen_created");
      if (acquired) {
        try {
          const teams = await getTeamsByLeague(input.leagueId, orgContext).catch(
            () => [],
          );
          const progress = parseFreshmenProgress(
            (
              await claimSeasonRolloverStage({
                rolloverId: rollover.rolloverId,
                stage: "freshmen_created",
                ownerId,
                leaseMs: ROLLOVER_STAGE_LEASE_MS,
              })
            ).freshmenProgressJson,
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
            if (toCreate === 0 && progress[team.id] === undefined) {
              progress[team.id] = 0;
            }
            if (progress[team.id] !== undefined) {
              continue;
            }

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
            const res = await createRolloverFreshmenForTeam({
              rolloverId: rollover.rolloverId,
              ownerId,
              teamId: team.id,
              players,
            });
            progress[team.id] = res.created;
          }
          summary.recruiting.freshmen = Object.values(progress).reduce(
            (sum, n) => sum + n,
            0,
          );
          summary.recruiting.toPool = input.freshmenToPool === true;
          const checkpoint = await advanceSeasonRollover({
            rolloverId: rollover.rolloverId,
            stage: "freshmen_created",
            summaryJson: serializeRolloverSummary(summary),
            ownerId,
          });
          stage = checkpoint.stage;
          summary = parseRolloverSummary(checkpoint.summaryJson, summary);
        } catch (err) {
          await releaseClaimedStage("freshmen_created", err);
          throw err;
        }
      }
    }

    /*
     * Heal the SOURCE season's open injuries (B2).
     *
     * Last before `completed` on purpose: it is the only stage that reaches
     * back into the season being closed rather than forward into the one being
     * built, so running it after the new roster exists keeps the "everything
     * that touches the target season" block contiguous.
     *
     * `healSeasonInjuries` is idempotent, so unlike the freshmen stage this
     * needs no per-item progress record — a retry after a lost response finds
     * zero open rows and reports zero. A failure to heal must not abort a
     * rollover that has already built the next season, so the count falls back
     * to whatever the summary already held rather than throwing.
     */
    if (!hasReachedRolloverStage(stage, "injuries_healed")) {
      const acquired = await claimStage("injuries_healed");
      if (acquired) {
        try {
          const healed = await healSeasonInjuries({
            seasonId: summary.sourceSeason.id,
          }).catch(() => null);
          if (healed) summary.healing.injuries = healed.healed;
          const checkpoint = await advanceSeasonRollover({
            rolloverId: rollover.rolloverId,
            stage: "injuries_healed",
            summaryJson: serializeRolloverSummary(summary),
            ownerId,
          });
          stage = checkpoint.stage;
          summary = parseRolloverSummary(checkpoint.summaryJson, summary);
        } catch (err) {
          await releaseClaimedStage("injuries_healed", err);
          throw err;
        }
      }
    }

    /*
     * Generate the incoming freshman class (B3).
     *
     * After the backfill, not instead of it. `freshmen_created` still tops
     * every roster up to the target size, so a league that never enters the
     * recruiting phase keeps playable rosters — a phase nobody visits must not
     * be able to produce a broken season. Prospects are the talent on top of
     * that floor, and a team that recruits well displaces walk-ons with them.
     *
     * Same failure posture as healing: by this point the next season exists
     * with full rosters, and a league with no recruiting board is strictly
     * better than a rollover stuck short of `completed`. Both the generation
     * and the persist fall back to zero rather than throwing.
     */
    if (!hasReachedRolloverStage(stage, "prospects_generated")) {
      const acquired = await claimStage("prospects_generated");
      if (acquired) {
        try {
          const config = await getDynastyConfig(input.leagueId).catch(
            () => null,
          );
          if (config?.recruitingEnabled !== false) {
            const teams = await getTeamsByLeague(
              input.leagueId,
              orgContext,
            ).catch(() => []);
            const prospects = generateProspectClass({
              seasonId: nextSeasonId,
              count: prospectClassSize(teams.length),
              excludeNames: activeNonGraduatedNames(leaguePlayers),
            });
            const created = await createProspectClass({
              leagueId: input.leagueId,
              seasonId: nextSeasonId,
              prospects: prospects.map((p) => ({
                name: p.name,
                position: p.position,
                positionGroup: p.positionGroup,
                archetype: p.archetype,
                hometown: p.hometown,
                trueAttributesJson: JSON.stringify(p.trueAttributes),
                trueOverall: p.trueOverall,
                potentialTier: p.potentialTier,
              })),
            }).catch(() => null);
            if (created) summary.recruiting.prospects = created.created;
          }
          const checkpoint = await advanceSeasonRollover({
            rolloverId: rollover.rolloverId,
            stage: "prospects_generated",
            summaryJson: serializeRolloverSummary(summary),
            ownerId,
          });
          stage = checkpoint.stage;
          summary = parseRolloverSummary(checkpoint.summaryJson, summary);
        } catch (err) {
          await releaseClaimedStage("prospects_generated", err);
          throw err;
        }
      }
    }

    if (!hasReachedRolloverStage(stage, "completed")) {
      const acquired = await claimStage("completed");
      if (acquired) {
        try {
          await advanceSeasonRollover({
            rolloverId: rollover.rolloverId,
            stage: "completed",
            summaryJson: serializeRolloverSummary(summary),
            ownerId,
          });
          stage = "completed";
        } catch (err) {
          await releaseClaimedStage("completed", err);
          throw err;
        }
      }
    }

    revalidatePath(`/dashboard/leagues/${input.leagueId}`);
    revalidatePath("/dashboard/seasons");
    revalidatePath(`/dashboard/seasons/${nextSeasonId}`);

    return {
      ok: true,
      seasonId: nextSeasonId,
      seasonName: summary.targetSeason.name,
      graduated: summary.graduation.players,
      advanced: summary.advancement.players,
      progressed: summary.progression.snapshots,
      freshmen: summary.recruiting.freshmen,
      summary,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
