/*
 * Persisted season team records (Dynasty Mode F2).
 *
 * Pure counter arithmetic for `seasonTeamRecords`, isolated from Convex `db`
 * calls so it unit-tests directly — the same discipline as `lib/standings.ts`.
 *
 * ## Why a table at all
 *
 * Standings were recomputed on every read by scanning every fixture in the
 * season and fetching each result. That is O(season) per render, and Epics C
 * (prestige, goals, job security) and D (polls, record books) all need the same
 * numbers, so the scan would have been paid several more times per season.
 *
 * ## Correctness model
 *
 * A record row is a CACHE. It holds nothing that cannot be rederived from
 * `fixtures` + `gameResults`, and `buildTeamRecord` is the definition of what
 * it should contain. The Convex layer keeps rows correct by rebuilding the two
 * affected teams from their own fixtures after each result write, rather than
 * by applying arithmetic deltas in place.
 *
 * That choice is deliberate. Wins, points and head-to-head are commutative, so
 * a true delta would work for them — but `streak` and `lastResults` depend on
 * game ORDER, and re-recording an earlier game (a re-sim under a new engine
 * version, say) cannot be corrected by adding and subtracting counters. A
 * rebuild from source is exactly equal to a full rebuild by construction, and
 * it is cheap: `fixtures` is already indexed `by_homeTeamId`/`by_awayTeamId`,
 * so a team's own games are a bounded read (~10–16 per season), not a scan.
 */

import type { TeamStats } from "./standings";

/** Head-to-head tally against a single opponent. */
export interface HeadToHeadRecord {
  w: number;
  l: number;
  t: number;
}

/** "W" | "L" | "T" — kept as a string for the Convex `v.array(v.string())`. */
export type ResultLetter = "W" | "L" | "T";

/** How many recent results a row retains. Purely a display affordance. */
export const LAST_RESULTS_LIMIT = 10;

export interface TeamSeasonRecordCounters {
  teamId: string;
  divisionId: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  divisionWins: number;
  divisionLosses: number;
  divisionTies: number;
  headToHead: Record<string, HeadToHeadRecord>;
  /** Positive = win streak, negative = loss streak, 0 = none or last was a tie. */
  streak: number;
  /** Most recent first, capped at `LAST_RESULTS_LIMIT`. */
  lastResults: ResultLetter[];
  gamesCounted: number;
}

/** One completed game from a single team's point of view. */
export interface TeamGameOutcome {
  opponentTeamId: string;
  teamScore: number;
  opponentScore: number;
  /** Both teams were in the same (non-null) division when this was played. */
  sameDivision: boolean;
}

export function emptyRecord(
  teamId: string,
  divisionId: string | null,
): TeamSeasonRecordCounters {
  return {
    teamId,
    divisionId,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    divisionWins: 0,
    divisionLosses: 0,
    divisionTies: 0,
    headToHead: {},
    streak: 0,
    lastResults: [],
    gamesCounted: 0,
  };
}

function outcomeLetter(o: TeamGameOutcome): ResultLetter {
  if (o.teamScore > o.opponentScore) return "W";
  if (o.teamScore < o.opponentScore) return "L";
  return "T";
}

/**
 * Fold ONE completed game into a record, returning a new object.
 *
 * Callers must apply outcomes in chronological order: `streak` and
 * `lastResults` are order-dependent (the counters are not).
 */
export function applyResultDelta(
  record: TeamSeasonRecordCounters,
  outcome: TeamGameOutcome,
): TeamSeasonRecordCounters {
  const letter = outcomeLetter(outcome);
  const prior = record.headToHead[outcome.opponentTeamId] ?? { w: 0, l: 0, t: 0 };
  const h2hKey = letter === "W" ? "w" : letter === "L" ? "l" : "t";

  // A tie ends a streak rather than extending it in either direction.
  const streak =
    letter === "T"
      ? 0
      : letter === "W"
        ? record.streak > 0
          ? record.streak + 1
          : 1
        : record.streak < 0
          ? record.streak - 1
          : -1;

  return {
    ...record,
    wins: record.wins + (letter === "W" ? 1 : 0),
    losses: record.losses + (letter === "L" ? 1 : 0),
    ties: record.ties + (letter === "T" ? 1 : 0),
    pointsFor: record.pointsFor + outcome.teamScore,
    pointsAgainst: record.pointsAgainst + outcome.opponentScore,
    divisionWins:
      record.divisionWins + (outcome.sameDivision && letter === "W" ? 1 : 0),
    divisionLosses:
      record.divisionLosses + (outcome.sameDivision && letter === "L" ? 1 : 0),
    divisionTies:
      record.divisionTies + (outcome.sameDivision && letter === "T" ? 1 : 0),
    headToHead: {
      ...record.headToHead,
      [outcome.opponentTeamId]: { ...prior, [h2hKey]: prior[h2hKey] + 1 },
    },
    streak,
    lastResults: [letter, ...record.lastResults].slice(0, LAST_RESULTS_LIMIT),
    gamesCounted: record.gamesCounted + 1,
  };
}

/**
 * The definition of a correct record: fold a team's completed games, oldest
 * first. Everything the Convex layer persists must equal this.
 */
export function buildTeamRecord(input: {
  teamId: string;
  divisionId: string | null;
  /** Chronological, oldest first. */
  outcomes: TeamGameOutcome[];
}): TeamSeasonRecordCounters {
  return input.outcomes.reduce<TeamSeasonRecordCounters>(
    (acc, outcome) => applyResultDelta(acc, outcome),
    emptyRecord(input.teamId, input.divisionId),
  );
}

export function serializeHeadToHead(
  headToHead: Record<string, HeadToHeadRecord>,
): string {
  return JSON.stringify(headToHead);
}

/** Tolerant of absent/corrupt JSON — a cache should never throw on read. */
export function parseHeadToHead(
  json: string | null | undefined,
): Record<string, HeadToHeadRecord> {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, HeadToHeadRecord>;
  } catch {
    return {};
  }
}

/** A persisted `seasonTeamRecords` row, narrowed to what ranking needs. */
export interface PersistedTeamRecord {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  divisionWins: number;
  divisionLosses: number;
  divisionTies: number;
  headToHeadJson: string;
}

export interface RankableTeam {
  _id: string;
  name: string;
  divisionId: string | null;
}

/**
 * Hydrate persisted rows into the shape `rankTeamStats` consumes.
 *
 * Every team in `teams` gets a row, including teams with no record yet — a
 * team that has not played must still appear in the standings at 0-0-0, which
 * is what the fixture-scanning implementation did.
 *
 * `divisionId` comes from the live `teams` row rather than the record's
 * snapshot, so a mid-season division move is reflected in grouping immediately;
 * only the divisional win/loss splits stay as-played until a rebuild.
 */
export function recordsToRankableStats(
  teams: RankableTeam[],
  records: PersistedTeamRecord[],
): TeamStats[] {
  const byTeam = new Map(records.map((r) => [r.teamId, r]));

  return teams.map((team) => {
    const record = byTeam.get(team._id);
    const headToHead = new Map<string, HeadToHeadRecord>(
      Object.entries(parseHeadToHead(record?.headToHeadJson)),
    );

    return {
      teamId: team._id,
      teamName: team.name,
      divisionId: team.divisionId ?? null,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      ties: record?.ties ?? 0,
      pointsFor: record?.pointsFor ?? 0,
      pointsAgainst: record?.pointsAgainst ?? 0,
      divisionWins: record?.divisionWins ?? 0,
      divisionLosses: record?.divisionLosses ?? 0,
      divisionTies: record?.divisionTies ?? 0,
      headToHead,
    };
  });
}
