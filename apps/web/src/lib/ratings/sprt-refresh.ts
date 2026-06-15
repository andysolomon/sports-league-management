/**
 * SPRT refresh orchestrator (WSM-000092) — the server-side form of the
 * CLI ingest, driven by the weekly cron. Pulls the latest nflverse
 * season, then for each public league's active season: matches players
 * by ESPN id, and (only when there are matches) clears the season's
 * snapshots and writes fresh SPRT ratings. Leagues with zero matches —
 * e.g. non-NFL leagues with admin-uploaded attributes — are skipped
 * untouched, so the refresh never wipes data it can't replace.
 */
import { getConvexClient } from "../convex-client";
import { makeFunctionReference } from "convex/server";
import type { LeagueDto, SeasonDto, TeamDto, PlayerDto } from "@sports-management/shared-types";
import {
  fetchSprtRatingsByEspnId,
  resolveLatestDataYear,
  espnIdFromHeadshot,
  ATTR_GROUP,
} from "./nflverse";

export interface SprtRefreshReport {
  dataYear: number | null;
  leagues: Array<{
    leagueId: string;
    leagueName: string;
    seasonId: string | null;
    matched: number;
    cleared: number;
    written: number;
    skipped?: string;
  }>;
}

type IngestRow = {
  playerId: string;
  positionGroup: string;
  attributesJson: string;
  weightedOverall: number | null;
};

export async function refreshSprtRatings(
  now: Date = new Date(),
): Promise<SprtRefreshReport> {
  const client = getConvexClient();
  const q = <A, R>(name: string, args: A) =>
    (client as unknown as { query: (r: unknown, a: unknown) => Promise<R> }).query(
      makeFunctionReference<"query">(name),
      args,
    );
  const m = <A, R>(name: string, args: A) =>
    (client as unknown as { mutation: (r: unknown, a: unknown) => Promise<R> }).mutation(
      makeFunctionReference<"mutation">(name),
      args,
    );

  const dataYear = await resolveLatestDataYear(now.getUTCFullYear());
  const report: SprtRefreshReport = { dataYear, leagues: [] };
  if (dataYear === null) return report;

  const ratings = await fetchSprtRatingsByEspnId(dataYear);

  const leagues = await q<Record<string, never>, LeagueDto[]>(
    "sports:listPublicLeagues",
    {},
  );

  for (const league of leagues) {
    const seasons = await q<{ leagueIds: string[] }, SeasonDto[]>(
      "sports:listSeasons",
      { leagueIds: [league.id] },
    );
    const activeSeason =
      seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
    if (!activeSeason) {
      report.leagues.push({
        leagueId: league.id,
        leagueName: league.name,
        seasonId: null,
        matched: 0,
        cleared: 0,
        written: 0,
        skipped: "no season",
      });
      continue;
    }

    const teams = await q<{ leagueId: string }, TeamDto[]>(
      "sports:listTeamsByLeague",
      { leagueId: league.id },
    );
    const rows: IngestRow[] = [];
    for (const team of teams) {
      const players = await q<{ teamId: string }, PlayerDto[]>(
        "sports:listPlayersByTeam",
        { teamId: team.id },
      );
      for (const p of players) {
        const espn = espnIdFromHeadshot(p.headshotUrl);
        const rating = espn ? ratings.get(espn) : undefined;
        if (!rating) continue;
        rows.push({
          playerId: p.id,
          positionGroup: ATTR_GROUP[rating.positionGroup],
          attributesJson: JSON.stringify({ ...rating.attributes, OVR: rating.overall }),
          weightedOverall: rating.overall,
        });
      }
    }

    // No matches → not an NFL-synced league; leave its data alone.
    if (rows.length === 0) {
      report.leagues.push({
        leagueId: league.id,
        leagueName: league.name,
        seasonId: activeSeason.id,
        matched: 0,
        cleared: 0,
        written: 0,
        skipped: "no nflverse matches",
      });
      continue;
    }

    const { deleted } = await m<{ seasonId: string }, { deleted: number }>(
      "sports:clearSeasonPlayerAttributes",
      { seasonId: activeSeason.id },
    );
    let written = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const res = await m<
        { seasonId: string; rows: IngestRow[] },
        { created: number; updated: number }
      >("sports:ingestPlayerAttributesBatch", {
        seasonId: activeSeason.id,
        rows: chunk,
      });
      written += res.created + res.updated;
    }

    report.leagues.push({
      leagueId: league.id,
      leagueName: league.name,
      seasonId: activeSeason.id,
      matched: rows.length,
      cleared: deleted,
      written,
    });
  }

  return report;
}
