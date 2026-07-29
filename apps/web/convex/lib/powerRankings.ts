/**
 * Weekly power rankings (Dynasty Mode D3).
 *
 * This module is deliberately pure: Convex supplies persisted team records
 * and the previous poll, while this code owns every scoring and damping rule.
 */

/** A team may move at most this many places between consecutive polls. */
export const MAX_WEEKLY_RANK_MOVEMENT = 2;

/** Point differential is useful signal, but one blowout must not own the poll. */
export const POINT_DIFFERENTIAL_CAP_PER_GAME = 21;

export interface PowerRankingRecord {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  headToHeadJson: string;
  lastResults: string[];
  gamesCounted: number;
}

export interface PreviousPowerRanking {
  teamId: string;
  rank: number;
}

export interface PowerRanking {
  teamId: string;
  rank: number;
  previousRank: number | null;
  /** Composite poll score on a 0–1000 scale. */
  points: number;
  record: {
    wins: number;
    losses: number;
    ties: number;
  };
  trend: "up" | "down" | "same" | "new";
}

interface ScoredTeam {
  record: PowerRankingRecord;
  points: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function gamesPlayed(record: PowerRankingRecord): number {
  return record.wins + record.losses + record.ties;
}

function winPercentage(record: PowerRankingRecord): number {
  const games = gamesPlayed(record);
  return games === 0 ? 0.5 : (record.wins + record.ties * 0.5) / games;
}

function parseOpponentIds(headToHeadJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(headToHeadJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.keys(parsed);
  } catch {
    return [];
  }
}

function strengthOfSchedule(
  record: PowerRankingRecord,
  recordsByTeam: ReadonlyMap<string, PowerRankingRecord>,
): number {
  const opponents = parseOpponentIds(record.headToHeadJson)
    .map((teamId) => recordsByTeam.get(teamId))
    .filter((opponent): opponent is PowerRankingRecord => Boolean(opponent));
  if (opponents.length === 0) return 0.5;
  return (
    opponents.reduce((sum, opponent) => sum + winPercentage(opponent), 0) /
    opponents.length
  );
}

function recencyScore(lastResults: readonly string[]): number {
  const recent = lastResults.slice(0, 5);
  if (recent.length === 0) return 0.5;
  const weights = [5, 4, 3, 2, 1];
  let weightedScore = 0;
  let weightTotal = 0;
  for (const [index, result] of recent.entries()) {
    const weight = weights[index] ?? 1;
    weightedScore +=
      weight * (result === "W" ? 1 : result === "T" ? 0.5 : 0);
    weightTotal += weight;
  }
  return weightTotal === 0 ? 0.5 : weightedScore / weightTotal;
}

function compositePoints(
  record: PowerRankingRecord,
  recordsByTeam: ReadonlyMap<string, PowerRankingRecord>,
): number {
  const games = Math.max(1, record.gamesCounted || gamesPlayed(record));
  const differentialPerGame =
    (record.pointsFor - record.pointsAgainst) / games;
  const cappedDifferential = clamp(
    differentialPerGame,
    -POINT_DIFFERENTIAL_CAP_PER_GAME,
    POINT_DIFFERENTIAL_CAP_PER_GAME,
  );
  const normalizedDifferential =
    (cappedDifferential + POINT_DIFFERENTIAL_CAP_PER_GAME) /
    (POINT_DIFFERENTIAL_CAP_PER_GAME * 2);

  // Results lead, while schedule and recent form keep equal records distinct.
  return Math.round(
    1000 *
      (winPercentage(record) * 0.45 +
        normalizedDifferential * 0.2 +
        strengthOfSchedule(record, recordsByTeam) * 0.2 +
        recencyScore(record.lastResults) * 0.15),
  );
}

function canOccupyIndex(
  teamId: string,
  nextIndex: number,
  previousIndexByTeam: ReadonlyMap<string, number>,
): boolean {
  const previousIndex = previousIndexByTeam.get(teamId);
  return (
    previousIndex === undefined ||
    Math.abs(nextIndex - previousIndex) <= MAX_WEEKLY_RANK_MOVEMENT
  );
}

/**
 * Move toward the raw order through bounded adjacent swaps.
 *
 * Starting from last week's permutation and swapping only adjacent inverted
 * pairs makes the damping visible: a great week can earn places, but never
 * more than MAX_WEEKLY_RANK_MOVEMENT. The output remains a permutation by
 * construction because teams are reordered, never regenerated.
 */
function dampedOrder(
  scored: readonly ScoredTeam[],
  previous: readonly PreviousPowerRanking[],
): ScoredTeam[] {
  const rawOrder = [...scored].sort(
    (a, b) =>
      b.points - a.points || a.record.teamId.localeCompare(b.record.teamId),
  );
  if (previous.length === 0) return rawOrder;

  const rawIndexByTeam = new Map(
    rawOrder.map((team, index) => [team.record.teamId, index]),
  );
  const previousRankByTeam = new Map(
    previous
      .filter((row) => Number.isInteger(row.rank) && row.rank > 0)
      .map((row) => [row.teamId, row.rank]),
  );
  const previousIndexByTeam = new Map(
    [...previousRankByTeam].map(([teamId, rank]) => [teamId, rank - 1]),
  );
  const order = [...scored].sort((a, b) => {
    const aPrevious =
      previousRankByTeam.get(a.record.teamId) ?? Number.MAX_SAFE_INTEGER;
    const bPrevious =
      previousRankByTeam.get(b.record.teamId) ?? Number.MAX_SAFE_INTEGER;
    return (
      aPrevious - bPrevious ||
      (rawIndexByTeam.get(a.record.teamId) ?? Number.MAX_SAFE_INTEGER) -
        (rawIndexByTeam.get(b.record.teamId) ?? Number.MAX_SAFE_INTEGER)
    );
  });

  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < order.length - 1; index += 1) {
      const left = order[index]!;
      const right = order[index + 1]!;
      const leftDesired = rawIndexByTeam.get(left.record.teamId) ?? index;
      const rightDesired =
        rawIndexByTeam.get(right.record.teamId) ?? index + 1;
      if (leftDesired <= rightDesired) continue;
      if (
        !canOccupyIndex(
          left.record.teamId,
          index + 1,
          previousIndexByTeam,
        ) ||
        !canOccupyIndex(right.record.teamId, index, previousIndexByTeam)
      ) {
        continue;
      }
      order[index] = right;
      order[index + 1] = left;
      changed = true;
    }
  }
  return order;
}

/**
 * Rank one record per team. Duplicate team ids are rejected because silently
 * dropping either row would violate the poll's permutation contract.
 */
export function computePowerRankings(
  records: readonly PowerRankingRecord[],
  previous: readonly PreviousPowerRanking[] = [],
): PowerRanking[] {
  const recordsByTeam = new Map<string, PowerRankingRecord>();
  for (const record of records) {
    if (recordsByTeam.has(record.teamId)) {
      throw new Error(`duplicate_power_ranking_team:${record.teamId}`);
    }
    recordsByTeam.set(record.teamId, record);
  }

  const scored = records.map((record) => ({
    record,
    points: compositePoints(record, recordsByTeam),
  }));
  const previousRankByTeam = new Map(
    previous.map((row) => [row.teamId, row.rank]),
  );

  return dampedOrder(scored, previous).map((team, index): PowerRanking => {
    const rank = index + 1;
    const previousRank = previousRankByTeam.get(team.record.teamId) ?? null;
    const trend =
      previousRank === null
        ? "new"
        : previousRank > rank
          ? "up"
          : previousRank < rank
            ? "down"
            : "same";
    return {
      teamId: team.record.teamId,
      rank,
      previousRank,
      points: team.points,
      record: {
        wins: team.record.wins,
        losses: team.record.losses,
        ties: team.record.ties,
      },
      trend,
    };
  });
}
