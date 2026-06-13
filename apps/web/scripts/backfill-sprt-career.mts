/**
 * SPRT career-history backfill (WSM-000094).
 *
 * One-time backfill that gives every rostered player a multi-season SPRT
 * trend on their development chart. For each completed NFL year in the
 * range, it ensures a dated `completed` season record exists per public
 * league (idempotent via upsertSeason) and ingests that year's SPRT
 * ratings, matched to our roster by ESPN id — exactly like the weekly
 * refresh, but looped over history.
 *
 * Design notes:
 *  - The latest completed season's data already lives in each league's
 *    *active* season (the weekly cron owns it), so the default range stops
 *    at the prior year to avoid a duplicate point. Override with --to.
 *  - A player only matches in years they actually played (ESPN id join), so
 *    no synthetic history is invented — a 2018 rookie simply has no 2017 row.
 *  - Leagues with zero matches in a year are left untouched (no empty season
 *    is created), so non-NFL leagues are never polluted.
 *  - nflverse publishes `stats_player_week_<year>` + `roster_<year>` back to
 *    1999; a missing/renamed asset for a year is logged and skipped, not fatal.
 *
 * Usage:
 *   NEXT_PUBLIC_CONVEX_URL=<prod-url> CONVEX_ADMIN_KEY=<key> \
 *     npx tsx apps/web/scripts/backfill-sprt-career.mts \
 *       [--from 1999] [--to 2024] [--league-id <id>] [--write]
 *   Dry-run by default: reports per-year match counts, writes nothing.
 */
import { ConvexHttpClient } from "convex/browser";
import {
  fetchSprtRatingsByEspnId,
  espnIdFromHeadshot,
  ATTR_GROUP,
} from "../src/lib/ratings/nflverse.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const FROM = Number(arg("from") ?? 1999);
const TO = Number(arg("to") ?? new Date().getUTCFullYear() - 1);
const ONLY_LEAGUE = arg("league-id");
const WRITE = has("write");

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is required (point it at the target deployment).");
  process.exit(1);
}
if (!Number.isInteger(FROM) || !Number.isInteger(TO) || FROM > TO) {
  console.error(`Invalid range --from ${FROM} --to ${TO}.`);
  process.exit(1);
}

type LeaguePlayer = { playerId: string; espn: string | null };
type IngestRow = {
  playerId: string;
  positionGroup: string;
  attributesJson: string;
  weightedOverall: number | null;
};

async function main() {
  const client = new ConvexHttpClient(CONVEX_URL!);
  const adminKey = process.env.CONVEX_ADMIN_KEY;
  if (adminKey) {
    (client as unknown as { setAdminAuth: (k: string) => void }).setAdminAuth(adminKey);
  }
  const q = (name: string, args: unknown) =>
    client.query(name as never, args as never) as Promise<unknown>;
  const m = (name: string, args: unknown) =>
    client.mutation(name as never, args as never) as Promise<unknown>;

  console.log(
    `SPRT career backfill — years ${FROM}–${TO}, ${WRITE ? "WRITE" : "DRY RUN"}, ` +
      `deployment ${CONVEX_URL}`,
  );

  // Resolve target leagues, then each league's roster (ESPN id) once.
  const leagues = ONLY_LEAGUE
    ? [{ id: ONLY_LEAGUE, name: ONLY_LEAGUE }]
    : ((await q("sports:listPublicLeagues", {})) as { id: string; name: string }[]);

  const leaguePlayers = new Map<string, LeaguePlayer[]>();
  for (const league of leagues) {
    const teams = (await q("sports:listTeamsByLeague", {
      leagueId: league.id,
    })) as { id: string }[];
    const roster: LeaguePlayer[] = [];
    for (const team of teams) {
      const players = (await q("sports:listPlayersByTeam", {
        teamId: team.id,
      })) as { id: string; headshotUrl: string | null }[];
      for (const p of players) {
        roster.push({ playerId: p.id, espn: espnIdFromHeadshot(p.headshotUrl) });
      }
    }
    leaguePlayers.set(league.id, roster);
    console.log(`  league ${league.name}: ${roster.length} players`);
  }

  let totalSeasons = 0;
  let totalWritten = 0;

  for (let year = FROM; year <= TO; year++) {
    let ratings;
    try {
      ratings = await fetchSprtRatingsByEspnId(year);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${year}: skipped — ${msg}`);
      continue;
    }

    for (const league of leagues) {
      const roster = leaguePlayers.get(league.id) ?? [];
      const rows: IngestRow[] = [];
      for (const p of roster) {
        const rating = p.espn ? ratings.get(p.espn) : undefined;
        if (!rating) continue;
        rows.push({
          playerId: p.playerId,
          positionGroup: ATTR_GROUP[rating.positionGroup],
          attributesJson: JSON.stringify({
            ...rating.attributes,
            OVR: rating.overall,
          }),
          weightedOverall: rating.overall,
        });
      }

      if (rows.length === 0) {
        console.log(`  ${year} · ${league.name}: 0 matches — skipped`);
        continue;
      }

      if (!WRITE) {
        console.log(`  ${year} · ${league.name}: ${rows.length} matches (dry run)`);
        continue;
      }

      const season = (await m("sports:upsertSeason", {
        name: `${year} NFL Season`,
        leagueId: league.id,
        startDate: `${year}-09-01`,
        endDate: `${year + 1}-02-15`,
        status: "completed",
      })) as { dto: { id: string }; created: boolean };
      if (season.created) totalSeasons += 1;

      await m("sports:clearSeasonPlayerAttributes", {
        seasonId: season.dto.id,
      });
      let written = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const res = (await m("sports:ingestPlayerAttributesBatch", {
          seasonId: season.dto.id,
          rows: rows.slice(i, i + 500),
        })) as { created: number; updated: number };
        written += res.created + res.updated;
      }
      totalWritten += written;
      console.log(
        `  ${year} · ${league.name}: ${rows.length} matched, wrote ${written}` +
          `${season.created ? " (new season)" : ""}`,
      );
    }
  }

  console.log(
    WRITE
      ? `Done — ${totalSeasons} seasons created, ${totalWritten} attribute rows written.`
      : "Dry run complete — pass --write to backfill.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
