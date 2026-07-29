/*
 * Season awards (Dynasty Mode D2).
 *
 * PURE RULE MODULE: no Convex imports. The persisted `scoreValue` on every
 * award is exactly one of the scores produced here, so a season can always
 * explain why one candidate ranked ahead of another.
 *
 * Documented weights (one point unless noted):
 * - offense: passing yard .04, passing TD 6, interception thrown -2,
 *   rushing/receiving yard .10, rushing/receiving TD 6, reception .5
 * - defense: solo/assisted tackle 1, sack 8, interception 10
 * - special teams: made FG 3, made XP 1, punt yard .04
 * - Player/Newcomer of the Year: offense + defense + special teams
 * - Offensive/Defensive Player of the Year: their named component
 * - Coach of the Year: win 10, tie 5, point differential .1
 * - All-Conference/All-State: the component matching the position group;
 *   unknown/OL groups use the all-purpose total (zero is a valid score).
 *
 * Tiebreak chain for players and coaches:
 *   1. score descending
 *   2. team wins descending
 *   3. team point differential descending
 *   4. stable recipient-name sort (case-insensitive name, then exact name and
 *      immutable id so duplicate names still form a total order)
 */

import { derivePositionGroup } from "./positions";

export const AWARD_TYPES = {
  playerOfYear: "player_of_year",
  offensivePlayerOfYear: "offensive_player_of_year",
  defensivePlayerOfYear: "defensive_player_of_year",
  newcomerOfYear: "newcomer_of_year",
  coachOfYear: "coach_of_year",
  allConference: "all_conference",
  allState: "all_state",
} as const;

export type AwardType = (typeof AWARD_TYPES)[keyof typeof AWARD_TYPES];
export type AwardTier = "state" | "conference";

export const AWARD_LABELS: Readonly<Record<AwardType, string>> = {
  player_of_year: "Player of the Year",
  offensive_player_of_year: "Offensive Player of the Year",
  defensive_player_of_year: "Defensive Player of the Year",
  newcomer_of_year: "Newcomer of the Year",
  coach_of_year: "Coach of the Year",
  all_conference: "All-Conference",
  all_state: "All-State",
};

export const AWARD_WEIGHTS = {
  offense: {
    passYards: 0.04,
    passTouchdowns: 6,
    interceptionsThrown: -2,
    rushYards: 0.1,
    rushTouchdowns: 6,
    receivingYards: 0.1,
    receivingTouchdowns: 6,
    receptions: 0.5,
  },
  defense: {
    tacklesSolo: 1,
    tacklesAssisted: 1,
    sacks: 8,
    interceptions: 10,
  },
  specialTeams: {
    fieldGoalsMade: 3,
    extraPointsMade: 1,
    puntYards: 0.04,
  },
  coach: {
    wins: 10,
    ties: 5,
    pointDifferential: 0.1,
  },
} as const;

export interface AwardAggregateInput {
  seasonId: string;
  teamId: string;
  playerId: string;
  /** F3 snapshot; callers may fall back to the immutable id for legacy rows. */
  playerName: string;
  position: string;
  positionGroup: string | null;
  gamesPlayed: number;
  totalsJson: string;
  /**
   * F3 snapshot. `undefined` keeps pre-D2 aggregates eligible rather than
   * silently withholding a full slate from an already completed season.
   */
  newcomerEligible?: boolean;
}

export interface AwardTeamRecordInput {
  teamId: string;
  divisionId: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface AwardCoachInput {
  coachId: string;
  coachName: string;
  teamId: string;
}

export interface ComputeSeasonAwardsInput {
  aggregates: readonly AwardAggregateInput[];
  teamRecords: readonly AwardTeamRecordInput[];
  coaches: readonly AwardCoachInput[];
}

export interface SeasonAward {
  type: AwardType;
  tier: AwardTier;
  playerId: string | null;
  coachId: string | null;
  teamId: string;
  divisionId: string | null;
  positionGroup: string | null;
  recipientName: string;
  scoreValue: number;
}

type StatLine = Record<string, Record<string, number>>;

function parseTotals(json: string): StatLine {
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object" ? (value as StatLine) : {};
  } catch {
    return {};
  }
}

function num(line: StatLine, group: string, field: string): number {
  const value = line[group]?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export interface PlayerAwardScores {
  offense: number;
  defense: number;
  specialTeams: number;
  overall: number;
}

/** Recompute the auditable components stored as award `scoreValue`s. */
export function scorePlayerSeason(
  aggregate: Pick<AwardAggregateInput, "totalsJson">,
): PlayerAwardScores {
  const line = parseTotals(aggregate.totalsJson);
  const offense =
    num(line, "passing", "yards") * AWARD_WEIGHTS.offense.passYards +
    num(line, "passing", "td") * AWARD_WEIGHTS.offense.passTouchdowns +
    num(line, "passing", "int") * AWARD_WEIGHTS.offense.interceptionsThrown +
    num(line, "rushing", "yards") * AWARD_WEIGHTS.offense.rushYards +
    num(line, "rushing", "td") * AWARD_WEIGHTS.offense.rushTouchdowns +
    num(line, "receiving", "yards") * AWARD_WEIGHTS.offense.receivingYards +
    num(line, "receiving", "td") * AWARD_WEIGHTS.offense.receivingTouchdowns +
    num(line, "receiving", "rec") * AWARD_WEIGHTS.offense.receptions;
  const defense =
    num(line, "defense", "tacklesSolo") * AWARD_WEIGHTS.defense.tacklesSolo +
    num(line, "defense", "tacklesAst") * AWARD_WEIGHTS.defense.tacklesAssisted +
    num(line, "defense", "sacks") * AWARD_WEIGHTS.defense.sacks +
    num(line, "defense", "int") * AWARD_WEIGHTS.defense.interceptions;
  const specialTeams =
    num(line, "kicking", "fgMade") * AWARD_WEIGHTS.specialTeams.fieldGoalsMade +
    num(line, "kicking", "xpMade") *
      AWARD_WEIGHTS.specialTeams.extraPointsMade +
    num(line, "punting", "yards") * AWARD_WEIGHTS.specialTeams.puntYards;
  return {
    offense,
    defense,
    specialTeams,
    overall: offense + defense + specialTeams,
  };
}

export function scoreCoachSeason(record: AwardTeamRecordInput): number {
  return (
    record.wins * AWARD_WEIGHTS.coach.wins +
    record.ties * AWARD_WEIGHTS.coach.ties +
    (record.pointsFor - record.pointsAgainst) *
      AWARD_WEIGHTS.coach.pointDifferential
  );
}

function positionScore(
  aggregate: AwardAggregateInput,
  scores: PlayerAwardScores,
): number {
  switch (awardPositionGroup(aggregate)) {
    case "QB":
    case "RB":
    case "WR":
    case "TE":
      return scores.offense;
    case "DL":
    case "LB":
    case "DB":
      return scores.defense;
    case "K/P":
      return scores.specialTeams;
    default:
      return scores.overall;
  }
}

function awardPositionGroup(aggregate: AwardAggregateInput): string {
  return (
    aggregate.positionGroup ??
    derivePositionGroup(aggregate.position) ??
    aggregate.position
  );
}

function stableNameCompare(
  a: { name: string; id: string },
  b: { name: string; id: string },
): number {
  const folded = a.name
    .toLocaleLowerCase("en-US")
    .localeCompare(b.name.toLocaleLowerCase("en-US"), "en-US");
  if (folded !== 0) return folded;
  const exact = a.name.localeCompare(b.name, "en-US");
  if (exact !== 0) return exact;
  return a.id.localeCompare(b.id, "en-US");
}

interface RankedPlayer {
  aggregate: AwardAggregateInput;
  score: number;
  record: AwardTeamRecordInput;
}

function compareRankedPlayers(a: RankedPlayer, b: RankedPlayer): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.record.wins !== b.record.wins) return b.record.wins - a.record.wins;
  const aDiff = a.record.pointsFor - a.record.pointsAgainst;
  const bDiff = b.record.pointsFor - b.record.pointsAgainst;
  if (aDiff !== bDiff) return bDiff - aDiff;
  return stableNameCompare(
    { name: a.aggregate.playerName, id: a.aggregate.playerId },
    { name: b.aggregate.playerName, id: b.aggregate.playerId },
  );
}

function playerAward(
  type: AwardType,
  ranked: RankedPlayer | undefined,
  tier: AwardTier,
  divisionId: string | null,
  positionGroup: string | null,
): SeasonAward | null {
  if (!ranked) return null;
  return {
    type,
    tier,
    playerId: ranked.aggregate.playerId,
    coachId: null,
    teamId: ranked.aggregate.teamId,
    divisionId,
    positionGroup,
    recipientName: ranked.aggregate.playerName,
    scoreValue: ranked.score,
  };
}

/**
 * Compute the complete deterministic season slate from F2/F3-shaped inputs.
 * Input iteration order never influences the result.
 */
export function computeSeasonAwards({
  aggregates,
  teamRecords,
  coaches,
}: ComputeSeasonAwardsInput): SeasonAward[] {
  const recordByTeam = new Map(teamRecords.map((row) => [row.teamId, row]));
  const scored = aggregates
    .map((aggregate) => {
      const record = recordByTeam.get(aggregate.teamId);
      if (!record) return null;
      return { aggregate, record, scores: scorePlayerSeason(aggregate) };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const rank = (
    score: (row: (typeof scored)[number]) => number,
    filter: (row: (typeof scored)[number]) => boolean = () => true,
  ) =>
    scored
      .filter(filter)
      .map((row) => ({
        aggregate: row.aggregate,
        record: row.record,
        score: score(row),
      }))
      .sort(compareRankedPlayers);

  const slate: SeasonAward[] = [];
  const add = (award: SeasonAward | null) => {
    if (award) slate.push(award);
  };

  add(
    playerAward(
      AWARD_TYPES.playerOfYear,
      rank((r) => r.scores.overall)[0],
      "state",
      null,
      null,
    ),
  );
  add(
    playerAward(
      AWARD_TYPES.offensivePlayerOfYear,
      rank((r) => r.scores.offense)[0],
      "state",
      null,
      null,
    ),
  );
  add(
    playerAward(
      AWARD_TYPES.defensivePlayerOfYear,
      rank((r) => r.scores.defense)[0],
      "state",
      null,
      null,
    ),
  );
  add(
    playerAward(
      AWARD_TYPES.newcomerOfYear,
      rank(
        (r) => r.scores.overall,
        (r) => r.aggregate.newcomerEligible !== false,
      )[0],
      "state",
      null,
      null,
    ),
  );

  const coachRanked = coaches
    .map((coach) => {
      const record = recordByTeam.get(coach.teamId);
      return record ? { coach, record, score: scoreCoachSeason(record) } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.record.wins !== b.record.wins) return b.record.wins - a.record.wins;
      const aDiff = a.record.pointsFor - a.record.pointsAgainst;
      const bDiff = b.record.pointsFor - b.record.pointsAgainst;
      if (aDiff !== bDiff) return bDiff - aDiff;
      return stableNameCompare(
        { name: a.coach.coachName, id: a.coach.coachId },
        { name: b.coach.coachName, id: b.coach.coachId },
      );
    });
  const coachWinner = coachRanked[0];
  if (coachWinner) {
    slate.push({
      type: AWARD_TYPES.coachOfYear,
      tier: "state",
      playerId: null,
      coachId: coachWinner.coach.coachId,
      teamId: coachWinner.coach.teamId,
      divisionId: coachWinner.record.divisionId,
      positionGroup: null,
      recipientName: coachWinner.coach.coachName,
      scoreValue: coachWinner.score,
    });
  }

  const positionGroups = [
    ...new Set(scored.map((row) => awardPositionGroup(row.aggregate))),
  ].sort((a, b) => a.localeCompare(b, "en-US"));
  const divisionIds = [
    ...new Set(
      teamRecords
        .map((row) => row.divisionId)
        .filter((id): id is string => id !== null),
    ),
  ].sort((a, b) => a.localeCompare(b, "en-US"));

  for (const divisionId of divisionIds) {
    for (const positionGroup of positionGroups) {
      add(
        playerAward(
          AWARD_TYPES.allConference,
          rank(
            (r) => positionScore(r.aggregate, r.scores),
            (r) =>
              r.record.divisionId === divisionId &&
              awardPositionGroup(r.aggregate) === positionGroup,
          )[0],
          "conference",
          divisionId,
          positionGroup,
        ),
      );
    }
  }
  for (const positionGroup of positionGroups) {
    add(
      playerAward(
        AWARD_TYPES.allState,
        rank(
          (r) => positionScore(r.aggregate, r.scores),
          (r) => awardPositionGroup(r.aggregate) === positionGroup,
        )[0],
        "state",
        null,
        positionGroup,
      ),
    );
  }

  return slate;
}
