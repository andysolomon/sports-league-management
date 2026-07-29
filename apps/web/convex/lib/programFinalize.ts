/*
 * Season-end program evaluation (Dynasty Mode C2).
 *
 * Called from `completeSeason` once per league season. Reads indexed F2/F3
 * caches only — goal evaluation never touches `playerGameStats` or `fixtures`.
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { emitDynastyEvent } from "./events";
import {
  COACH_ROLE_HEAD,
  COACH_STATUS_AI,
  COACH_STATUS_FIRED,
  generateAiHeadCoachProfile,
} from "./coach";
import { resolveDynastyConfig } from "./dynastyConfig";
import {
  evaluateGoals,
  generateGoals,
  type EvaluatedGoal,
  type SeasonGoal,
} from "./goals";
import { applyPrestigeDelta } from "./prestige";
import { computeJobSecurity, shouldFireCoach } from "./jobSecurity";
import { resolveProgram } from "./resolveProgram";
import {
  computeSeasonSkillPointsAward,
  ratingsFromSkillState,
  coachSkillsStateFromRow,
  serializeUnlockedNodes,
} from "./coachSkills";

export function coachFiredDedupeKey(coachId: string, seasonId: string): string {
  return `coach_fired:${coachId}:${seasonId}`;
}

export interface FinalizeProgramSeasonResult {
  teamsProcessed: number;
  coachesFired: number;
}

export async function finalizeProgramSeason(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
): Promise<FinalizeProgramSeasonResult> {
  const season = await ctx.db.get(seasonId);
  if (!season) throw new Error("season_not_found");

  const configRow = await ctx.db
    .query("dynastyConfig")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
    .unique();
  const config = resolveDynastyConfig(configRow);

  const teams = await ctx.db
    .query("teams")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", season.leagueId))
    .collect();

  const aggregateRows = await ctx.db
    .query("playerSeasonAggregates")
    .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
    .collect();

  const aggregatesByTeam = new Map<string, typeof aggregateRows>();
  for (const row of aggregateRows) {
    const key = row.teamId as string;
    const list = aggregatesByTeam.get(key) ?? [];
    list.push(row);
    aggregatesByTeam.set(key, list);
  }

  const now = new Date().toISOString();
  let coachesFired = 0;

  for (const team of teams) {
    const record = await ctx.db
      .query("seasonTeamRecords")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", seasonId).eq("teamId", team._id),
      )
      .unique();

    const teamAggregates = aggregatesByTeam.get(team._id as string) ?? [];

    const programRow = await ctx.db
      .query("teamSeasonPrograms")
      .withIndex("by_seasonId_teamId", (q) =>
        q.eq("seasonId", seasonId).eq("teamId", team._id),
      )
      .unique();

    const resolved = resolveProgram(programRow);
    const goals: SeasonGoal[] = programRow?.seasonGoalsJson
      ? (JSON.parse(programRow.seasonGoalsJson) as SeasonGoal[])
      : generateGoals(team._id as string, seasonId as string);

    const recordInput = record
      ? {
          wins: record.wins,
          losses: record.losses,
          ties: record.ties,
          pointsFor: record.pointsFor,
          pointsAgainst: record.pointsAgainst,
        }
      : {
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
        };

    const evaluated: EvaluatedGoal[] = evaluateGoals(
      goals,
      recordInput,
      teamAggregates.map((row) => ({ totalsJson: row.totalsJson })),
    );

    const { prestige, delta: prestigeDelta } = applyPrestigeDelta(
      resolved.prestige,
      {
        wins: recordInput.wins,
        losses: recordInput.losses,
        ties: recordInput.ties,
        evaluatedGoals: evaluated,
      },
    );

    const jobSecurity = computeJobSecurity({
      current: resolved.jobSecurity,
      evaluatedGoals: evaluated,
      wins: recordInput.wins,
      losses: recordInput.losses,
      ties: recordInput.ties,
    });

    const metCount = evaluated.filter((g) => g.status === "met").length;
    const boosterConfidence = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (resolved.boosterConfidence ?? 50) +
            (metCount - evaluated.length / 2) * 5,
        ),
      ),
    );

    const programPatch = {
      prestige,
      seasonGoalsJson: JSON.stringify(goals),
      jobSecurity,
      boosterConfidence,
      updatedAt: now,
      updatedBy: "system:completeSeason",
    };

    if (programRow) {
      await ctx.db.patch(programRow._id, programPatch);
    } else {
      await ctx.db.insert("teamSeasonPrograms", {
        leagueId: season.leagueId,
        seasonId,
        teamId: team._id,
        createdAt: now,
        ...programPatch,
      });
    }

    const headCoach = await ctx.db
      .query("coaches")
      .withIndex("by_teamId_role", (q) =>
        q.eq("teamId", team._id).eq("role", COACH_ROLE_HEAD),
      )
      .unique();

    if (headCoach) {
      const coachSeason = await ctx.db
        .query("coachSeasons")
        .withIndex("by_coach_season", (q) =>
          q.eq("coachId", headCoach._id).eq("seasonId", seasonId),
        )
        .unique();

      const skillPointsAward = computeSeasonSkillPointsAward({
        evaluatedGoals: evaluated,
        prestigeDelta,
      });
      const previousAward = coachSeason?.skillPointsAwarded ?? 0;
      const currentPoints =
        typeof headCoach.skillPoints === "number" &&
        Number.isFinite(headCoach.skillPoints)
          ? Math.max(0, headCoach.skillPoints)
          : 0;
      const nextSkillPoints = Math.max(
        0,
        currentPoints - previousAward + skillPointsAward,
      );

      const coachSeasonPayload = {
        wins: recordInput.wins,
        losses: recordInput.losses,
        ties: recordInput.ties,
        goalsMetJson: JSON.stringify(evaluated),
        prestigeDelta,
        skillPointsAwarded: skillPointsAward,
        finalizedAt: now,
      };

      if (coachSeason) {
        await ctx.db.patch(coachSeason._id, coachSeasonPayload);
      } else {
        await ctx.db.insert("coachSeasons", {
          coachId: headCoach._id,
          seasonId,
          teamId: team._id,
          ...coachSeasonPayload,
        });
      }

      const skillRatings = ratingsFromSkillState(
        coachSkillsStateFromRow({
          skillPoints: nextSkillPoints,
          unlockedNodesJson: headCoach.unlockedNodesJson,
        }),
      );
      const coachPatch: {
        skillPoints: number;
        updatedAt: string;
        developmentRating?: number;
        recruitingRating?: number;
        gameplanRating?: number;
      } = {
        skillPoints: nextSkillPoints,
        updatedAt: now,
      };
      if (skillRatings.developmentRating !== null) {
        coachPatch.developmentRating = skillRatings.developmentRating;
      }
      if (skillRatings.recruitingRating !== null) {
        coachPatch.recruitingRating = skillRatings.recruitingRating;
      }
      if (skillRatings.gameplanRating !== null) {
        coachPatch.gameplanRating = skillRatings.gameplanRating;
      }
      await ctx.db.patch(headCoach._id, coachPatch);

      if (shouldFireCoach(jobSecurity, config.jobSecurityEnabled)) {
        await ctx.db.patch(headCoach._id, {
          status: COACH_STATUS_FIRED,
          teamId: null,
          updatedAt: now,
        });
        coachesFired += 1;

        await emitDynastyEvent(ctx, {
          leagueId: season.leagueId,
          seasonId,
          teamId: team._id,
          dedupeKey: coachFiredDedupeKey(headCoach._id as string, seasonId as string),
          narrative: {
            type: "coach_fired",
            coachName: headCoach.displayName,
            teamName: team.name,
            seasonName: season.name,
          },
        });

        const profile = generateAiHeadCoachProfile(team._id as string);
        await ctx.db.insert("coaches", {
          leagueId: season.leagueId,
          teamId: team._id,
          displayName: profile.displayName,
          role: COACH_ROLE_HEAD,
          status: COACH_STATUS_AI,
          archetype: profile.archetype,
          offensiveSchemePreference: profile.offensiveSchemePreference ?? undefined,
          defensiveSchemePreference: profile.defensiveSchemePreference ?? undefined,
          aggression: profile.aggression,
          clockManagement: profile.clockManagement,
          developmentRating: profile.developmentRating,
          recruitingRating: profile.recruitingRating,
          gameplanRating: profile.gameplanRating,
          prestige: profile.prestige,
          skillPoints: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  return { teamsProcessed: teams.length, coachesFired };
}
