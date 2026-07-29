import { categoryValues } from "./statLeaders";
import { parseCareerStatLine } from "./careerTotals";

export const RECORD_CATEGORY_LABELS = {
  passYards: "Passing yards",
  passTD: "Passing touchdowns",
  rushYards: "Rushing yards",
  rushTD: "Rushing touchdowns",
  recYards: "Receiving yards",
  receptions: "Receptions",
  tackles: "Tackles",
  sacks: "Sacks",
  interceptions: "Interceptions",
  teamWins: "Team wins",
  teamPointsFor: "Team points scored",
  teamPointDifferential: "Team point differential",
} as const;

export interface SeasonAggregateForRecords {
  seasonId: string;
  teamId: string;
  playerId: string;
  totalsJson: string;
}

export interface SeasonTeamRecordForRecords {
  seasonId: string;
  teamId: string;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface RecordCandidate {
  category: string;
  span: "season";
  value: number;
  seasonId: string;
  teamId: string;
  playerId: string | null;
  stableKey: string;
}

export interface ProgramRecordEntry extends RecordCandidate {
  rank: number;
}

function playerCandidate(
  aggregate: SeasonAggregateForRecords,
  category: string,
  value: number,
): RecordCandidate {
  return {
    category,
    span: "season",
    value,
    seasonId: aggregate.seasonId,
    teamId: aggregate.teamId,
    playerId: aggregate.playerId,
    stableKey: [
      "season",
      category,
      aggregate.seasonId,
      aggregate.teamId,
      aggregate.playerId,
    ].join(":"),
  };
}

function teamCandidate(
  record: SeasonTeamRecordForRecords,
  category: string,
  value: number,
): RecordCandidate {
  return {
    category,
    span: "season",
    value,
    seasonId: record.seasonId,
    teamId: record.teamId,
    playerId: null,
    stableKey: ["season", category, record.seasonId, record.teamId, "team"].join(
      ":",
    ),
  };
}

/**
 * Flatten one completed season's F2/F3 caches into record-book candidates.
 * Zero/negative rows are omitted: they cannot be a positive achievement and
 * would otherwise fill an empty book with tied zeroes.
 */
export function recordCandidatesFromSeason(
  aggregates: readonly SeasonAggregateForRecords[],
  teamRecords: readonly SeasonTeamRecordForRecords[],
): RecordCandidate[] {
  const candidates: RecordCandidate[] = [];

  for (const aggregate of aggregates) {
    const values = categoryValues(parseCareerStatLine(aggregate.totalsJson));
    for (const category of Object.keys(RECORD_CATEGORY_LABELS)) {
      if (category.startsWith("team")) continue;
      const value = values[category] ?? 0;
      if (Number.isFinite(value) && value > 0) {
        candidates.push(playerCandidate(aggregate, category, value));
      }
    }
  }

  for (const record of teamRecords) {
    const values = {
      teamWins: record.wins,
      teamPointsFor: record.pointsFor,
      teamPointDifferential: record.pointsFor - record.pointsAgainst,
    };
    for (const [category, value] of Object.entries(values)) {
      if (Number.isFinite(value) && value > 0) {
        candidates.push(teamCandidate(record, category, value));
      }
    }
  }

  return candidates;
}

function compareRecordEntries(
  a: RecordCandidate,
  b: RecordCandidate,
): number {
  if (a.value !== b.value) return b.value - a.value;
  const season = a.seasonId.localeCompare(b.seasonId);
  if (season !== 0) return season;
  const team = a.teamId.localeCompare(b.teamId);
  if (team !== 0) return team;
  const player = (a.playerId ?? "").localeCompare(b.playerId ?? "");
  if (player !== 0) return player;
  // Final deterministic key: distinct entries can never compare as an
  // accidental tie, so Array.sort cannot inherit database iteration order.
  return a.stableKey.localeCompare(b.stableKey);
}

/**
 * Merge record candidates into a deterministic top-N per category.
 *
 * Candidate stable keys overwrite the same prior entry, so retrying a season
 * replaces its contribution rather than duplicating it. `broken` contains only
 * candidates that newly enter/improve the retained book; an unchanged retry
 * therefore returns an empty array.
 */
export function mergeTopN(
  existing: readonly ProgramRecordEntry[],
  candidates: readonly RecordCandidate[],
  limit = 10,
): { entries: ProgramRecordEntry[]; broken: ProgramRecordEntry[] } {
  const safeLimit = Math.max(0, Math.floor(limit));
  const previousByKey = new Map(existing.map((entry) => [entry.stableKey, entry]));
  const mergedByKey = new Map<string, RecordCandidate>();
  for (const entry of existing) mergedByKey.set(entry.stableKey, entry);
  for (const candidate of candidates) {
    mergedByKey.set(candidate.stableKey, candidate);
  }

  const categories = new Map<string, RecordCandidate[]>();
  for (const entry of mergedByKey.values()) {
    const category = categories.get(entry.category) ?? [];
    category.push(entry);
    categories.set(entry.category, category);
  }

  const entries: ProgramRecordEntry[] = [];
  for (const category of [...categories.keys()].sort()) {
    const ranked = [...(categories.get(category) ?? [])]
      .sort(compareRecordEntries)
      .slice(0, safeLimit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
    entries.push(...ranked);
  }

  const candidateKeys = new Set(candidates.map((entry) => entry.stableKey));
  const broken = entries.filter((entry) => {
    if (!candidateKeys.has(entry.stableKey)) return false;
    const previous = previousByKey.get(entry.stableKey);
    if (!previous) return true;
    return entry.value > previous.value || entry.rank < previous.rank;
  });

  return { entries, broken };
}
