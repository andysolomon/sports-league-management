import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { AWARD_LABELS, computeSeasonAwards, type SeasonAward } from "./awards";
import { COACH_ROLE_HEAD } from "./coach";
import { emitDynastyEvent } from "./events";

function awardIdentity(award: {
  type: string;
  tier: string;
  playerId: string | null;
  coachId: string | null;
  divisionId: string | null;
  positionGroup: string | null;
}): string {
  return [
    award.type,
    award.tier,
    award.playerId ?? "",
    award.coachId ?? "",
    award.divisionId ?? "",
    award.positionGroup ?? "",
  ].join(":");
}

export function awardDedupeKey(
  seasonId: string,
  award: Parameters<typeof awardIdentity>[0],
): string {
  return `award:${seasonId}:${awardIdentity(award)}`;
}

function sameAward(row: Doc<"awards">, award: SeasonAward): boolean {
  return (
    row.type === award.type &&
    row.tier === award.tier &&
    (row.playerId ?? null) === award.playerId &&
    (row.coachId ?? null) === award.coachId &&
    row.teamId === award.teamId &&
    (row.divisionId ?? null) === award.divisionId &&
    row.positionGroup === award.positionGroup &&
    row.scoreValue === award.scoreValue
  );
}

/**
 * Persist D2 awards from the F2/F3 rows already loaded by history finalization.
 * The only additional source read is `coaches`; no per-game table is touched.
 */
export async function finalizeSeasonAwards(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
  leagueId: Id<"leagues">,
  aggregates: Doc<"playerSeasonAggregates">[],
  teamRecords: Doc<"seasonTeamRecords">[],
): Promise<{ awardsWritten: number }> {
  const [coaches, existingRows] = await Promise.all([
    ctx.db
      .query("coaches")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
      .collect(),
    ctx.db
      .query("awards")
      .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
      .collect(),
  ]);

  const slate = computeSeasonAwards({
    aggregates: aggregates.map((row) => ({
      seasonId: row.seasonId,
      teamId: row.teamId,
      playerId: row.playerId,
      playerName: row.playerName ?? (row.playerId as string),
      position: row.position,
      positionGroup: row.positionGroup,
      gamesPlayed: row.gamesPlayed,
      totalsJson: row.totalsJson,
      newcomerEligible: row.newcomerEligible,
    })),
    teamRecords: teamRecords.map((row) => ({
      teamId: row.teamId,
      divisionId: row.divisionId,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
    })),
    coaches: coaches
      .filter(
        (coach) => coach.role === COACH_ROLE_HEAD && coach.teamId !== null,
      )
      .map((coach) => ({
        coachId: coach._id,
        coachName: coach.displayName,
        teamId: coach.teamId as Id<"teams">,
      })),
  });

  const existingByKey = new Map(
    existingRows.map((row) => [
      awardIdentity({
        type: row.type,
        tier: row.tier,
        playerId: row.playerId,
        coachId: row.coachId,
        divisionId: row.divisionId,
        positionGroup: row.positionGroup,
      }),
      row,
    ]),
  );
  const retained = new Set(slate.map(awardIdentity));
  const now = new Date().toISOString();
  let awardsWritten = 0;

  for (const row of existingRows) {
    const key = awardIdentity({
      type: row.type,
      tier: row.tier,
      playerId: row.playerId,
      coachId: row.coachId,
      divisionId: row.divisionId,
      positionGroup: row.positionGroup,
    });
    if (!retained.has(key)) {
      await ctx.db.delete(row._id);
      awardsWritten += 1;
    }
  }

  for (const award of slate) {
    const existing = existingByKey.get(awardIdentity(award));
    const payload = {
      leagueId,
      seasonId,
      type: award.type,
      tier: award.tier,
      playerId:
        award.playerId === null ? null : (award.playerId as Id<"players">),
      coachId: award.coachId === null ? null : (award.coachId as Id<"coaches">),
      teamId: award.teamId as Id<"teams">,
      divisionId:
        award.divisionId === null
          ? null
          : (award.divisionId as Id<"divisions">),
      positionGroup: award.positionGroup,
      scoreValue: award.scoreValue,
      updatedAt: now,
    };

    if (existing) {
      if (!sameAward(existing, award)) {
        await ctx.db.patch(existing._id, payload);
        awardsWritten += 1;
      }
    } else {
      await ctx.db.insert("awards", {
        ...payload,
        createdAt: now,
      });
      awardsWritten += 1;
    }

    await emitDynastyEvent(ctx, {
      leagueId,
      seasonId,
      teamId: award.teamId as Id<"teams">,
      playerId:
        award.playerId === null ? null : (award.playerId as Id<"players">),
      dedupeKey: awardDedupeKey(seasonId, award),
      narrative: {
        type: "award_won",
        recipientName: award.recipientName,
        awardName: AWARD_LABELS[award.type],
        positionGroup: award.positionGroup,
      },
      severity:
        award.type === "player_of_year" || award.type === "coach_of_year"
          ? "headline"
          : "notable",
      detail: {
        type: award.type,
        tier: award.tier,
        coachId: award.coachId,
        divisionId: award.divisionId,
        positionGroup: award.positionGroup,
        scoreValue: award.scoreValue,
      },
    });
  }

  return { awardsWritten };
}
