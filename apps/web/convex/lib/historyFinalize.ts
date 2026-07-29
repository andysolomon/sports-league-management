import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  parseCareerSeasonTotals,
  parseCareerStatLine,
  serializeCareerSeasonTotals,
  sumCareerSeasonTotals,
} from "./careerTotals";
import {
  mergeTopN,
  recordCandidatesFromSeason,
  type ProgramRecordEntry,
  type RecordCandidate,
} from "./records";
import { finalizeSeasonAwards } from "./awardsFinalize";

export interface FinalizeSeasonHistoryResult {
  careerTotalsUpdated: number;
  recordsUpdated: number;
  recordsBroken: number;
}

function recordEntryFromRow(
  row: Doc<"programRecords">,
): ProgramRecordEntry {
  return {
    category: row.category,
    span: "season",
    rank: row.rank,
    value: row.value,
    seasonId: row.seasonId,
    teamId: row.holderTeamId,
    playerId: row.playerId ?? null,
    stableKey: row.stableKey,
  };
}

function sameRecord(
  row: Doc<"programRecords">,
  entry: ProgramRecordEntry,
): boolean {
  return (
    row.category === entry.category &&
    row.span === entry.span &&
    row.rank === entry.rank &&
    row.value === entry.value &&
    (row.playerId ?? null) === entry.playerId &&
    row.holderTeamId === entry.teamId &&
    row.seasonId === entry.seasonId &&
    row.stableKey === entry.stableKey
  );
}

async function persistRecordScope(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  scopeTeamId: Id<"teams"> | undefined,
  existingRows: Doc<"programRecords">[],
  candidates: RecordCandidate[],
  now: string,
): Promise<{ updated: number; broken: number }> {
  const { entries, broken } = mergeTopN(
    existingRows.map(recordEntryFromRow),
    candidates,
    10,
  );
  const existingByKey = new Map(
    existingRows.map((row) => [row.stableKey, row]),
  );
  const retainedKeys = new Set(entries.map((entry) => entry.stableKey));
  let updated = 0;

  for (const row of existingRows) {
    if (!retainedKeys.has(row.stableKey)) {
      await ctx.db.delete(row._id);
      updated += 1;
    }
  }

  for (const entry of entries) {
    const existing = existingByKey.get(entry.stableKey);
    if (existing) {
      if (!sameRecord(existing, entry)) {
        await ctx.db.patch(existing._id, {
          category: entry.category,
          span: entry.span,
          rank: entry.rank,
          value: entry.value,
          playerId:
            entry.playerId === null
              ? undefined
              : (entry.playerId as Id<"players">),
          holderTeamId: entry.teamId as Id<"teams">,
          seasonId: entry.seasonId as Id<"seasons">,
          updatedAt: now,
        });
        updated += 1;
      }
      continue;
    }

    await ctx.db.insert("programRecords", {
      leagueId,
      ...(scopeTeamId ? { teamId: scopeTeamId } : {}),
      category: entry.category,
      span: entry.span,
      rank: entry.rank,
      value: entry.value,
      ...(entry.playerId === null
        ? {}
        : { playerId: entry.playerId as Id<"players"> }),
      holderTeamId: entry.teamId as Id<"teams">,
      seasonId: entry.seasonId as Id<"seasons">,
      stableKey: entry.stableKey,
      updatedAt: now,
    });
    updated += 1;
  }

  return { updated, broken: broken.length };
}

/**
 * Materialize one completed season's F2/F3 caches into cross-season history.
 *
 * Source reads are exactly one indexed batch of player aggregates and one
 * indexed batch of team records. Existing materialized rows are loaded once
 * per League; there is no player-by-player `get` or source-table scan.
 */
export async function finalizeSeasonHistoryForSeason(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
): Promise<FinalizeSeasonHistoryResult> {
  const aggregates = await ctx.db
    .query("playerSeasonAggregates")
    .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
    .collect();
  const teamRecords = await ctx.db
    .query("seasonTeamRecords")
    .withIndex("by_seasonId", (q) => q.eq("seasonId", seasonId))
    .collect();

  const leagueIds = new Set<string>([
    ...aggregates.map((row) => row.leagueId as string),
    ...teamRecords.map((row) => row.leagueId as string),
  ]);
  if (leagueIds.size === 0) {
    return {
      careerTotalsUpdated: 0,
      recordsUpdated: 0,
      recordsBroken: 0,
    };
  }
  if (leagueIds.size !== 1) throw new Error("history_league_mismatch");
  const leagueId = [...leagueIds][0] as Id<"leagues">;

  await finalizeSeasonAwards(
    ctx,
    seasonId,
    leagueId,
    aggregates,
    teamRecords,
  );

  const careerRows = await ctx.db
    .query("playerCareerTotals")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .collect();
  const existingRecordRows = await ctx.db
    .query("programRecords")
    .withIndex("by_leagueId_category_rank", (q) =>
      q.eq("leagueId", leagueId),
    )
    .collect();

  const careerByPlayerId = new Map(
    careerRows.map((row) => [row.playerId as string, row]),
  );
  const now = new Date().toISOString();
  let careerTotalsUpdated = 0;

  for (const aggregate of aggregates) {
    const existing = careerByPlayerId.get(aggregate.playerId as string);
    const seasons = existing
      ? parseCareerSeasonTotals(existing.seasonTotalsJson)
      : {};
    seasons[seasonId as string] = parseCareerStatLine(aggregate.totalsJson);
    const seasonTotalsJson = serializeCareerSeasonTotals(seasons);
    const totalsJson = JSON.stringify(sumCareerSeasonTotals(seasons));

    if (existing) {
      if (
        existing.seasonTotalsJson !== seasonTotalsJson ||
        existing.totalsJson !== totalsJson
      ) {
        await ctx.db.patch(existing._id, {
          seasonTotalsJson,
          totalsJson,
          updatedAt: now,
        });
        careerTotalsUpdated += 1;
      }
    } else {
      const id = await ctx.db.insert("playerCareerTotals", {
        leagueId,
        playerId: aggregate.playerId,
        totalsJson,
        seasonTotalsJson,
        updatedAt: now,
      });
      careerByPlayerId.set(aggregate.playerId as string, {
        _id: id,
        _creationTime: 0,
        leagueId,
        playerId: aggregate.playerId,
        totalsJson,
        seasonTotalsJson,
        updatedAt: now,
      });
      careerTotalsUpdated += 1;
    }
  }

  const candidates = recordCandidatesFromSeason(aggregates, teamRecords);
  const leagueRows = existingRecordRows.filter(
    (row) => row.teamId === undefined,
  );
  const leagueResult = await persistRecordScope(
    ctx,
    leagueId,
    undefined,
    leagueRows,
    candidates,
    now,
  );
  let recordsUpdated = leagueResult.updated;
  let recordsBroken = leagueResult.broken;

  const rowsByTeam = new Map<string, Doc<"programRecords">[]>();
  for (const row of existingRecordRows) {
    if (!row.teamId) continue;
    const rows = rowsByTeam.get(row.teamId as string) ?? [];
    rows.push(row);
    rowsByTeam.set(row.teamId as string, rows);
  }
  const candidatesByTeam = new Map<string, RecordCandidate[]>();
  for (const candidate of candidates) {
    const rows = candidatesByTeam.get(candidate.teamId) ?? [];
    rows.push(candidate);
    candidatesByTeam.set(candidate.teamId, rows);
  }
  for (const [teamId, teamCandidates] of candidatesByTeam) {
    const result = await persistRecordScope(
      ctx,
      leagueId,
      teamId as Id<"teams">,
      rowsByTeam.get(teamId) ?? [],
      teamCandidates,
      now,
    );
    recordsUpdated += result.updated;
    recordsBroken += result.broken;
  }

  return { careerTotalsUpdated, recordsUpdated, recordsBroken };
}
