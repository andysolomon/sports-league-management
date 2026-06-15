/**
 * SPRT Rating ingest — CLI form (WSM-000091/92).
 *
 * Ad-hoc / specific-season ingest. The weekly automated refresh lives in
 * the cron (src/app/api/cron/sprt-refresh); both share the rating engine
 * in src/lib/ratings. Pulls a season's open nflverse data, computes SPRT
 * ratings, matches to our roster via ESPN id, and loads through
 * ingestPlayerAttributesBatch. Dry-run by default; pass --write.
 *
 * Usage:
 *   npx tsx apps/web/scripts/ingest-sprt-ratings.mts \
 *     --season-id <convexSeasonId> --league-id <convexLeagueId> \
 *     [--data-year 2025] [--write]
 *   (NEXT_PUBLIC_CONVEX_URL env points at the target deployment.)
 */
import { ConvexHttpClient } from "convex/browser";
import {
  fetchSprtRatingsByEspnId,
  resolveLatestDataYear,
  espnIdFromHeadshot,
  ATTR_GROUP,
} from "../src/lib/ratings/nflverse.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const SEASON_ID = arg("season-id");
const LEAGUE_ID = arg("league-id");
const WRITE = has("write");

if (!SEASON_ID || !LEAGUE_ID) {
  console.error("Required: --season-id <id> --league-id <id>");
  process.exit(1);
}
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is required.");
  process.exit(1);
}

async function main() {
  const dataYear =
    Number(arg("data-year")) ||
    (await resolveLatestDataYear(new Date().getUTCFullYear()));
  if (!dataYear) {
    console.error("No nflverse season data found.");
    process.exit(1);
  }
  console.log(`SPRT ingest — data year ${dataYear}, ${WRITE ? "WRITE" : "DRY RUN"}`);

  const ratings = await fetchSprtRatingsByEspnId(dataYear);
  console.log(`computed ${ratings.size} SPRT ratings (by espn_id)`);

  const client = new ConvexHttpClient(CONVEX_URL);
  const adminKey = process.env.CONVEX_ADMIN_KEY;
  if (adminKey) {
    (client as unknown as { setAdminAuth: (k: string) => void }).setAdminAuth(adminKey);
  }
  const teams = (await client.query("sports:listTeamsByLeague" as never, { leagueId: LEAGUE_ID } as never)) as { id: string }[];

  const rows: { playerId: string; positionGroup: string; attributesJson: string; weightedOverall: number | null }[] = [];
  let matched = 0;
  let unmatched = 0;
  for (const team of teams) {
    const players = (await client.query("sports:listPlayersByTeam" as never, { teamId: team.id } as never)) as {
      id: string; headshotUrl: string | null;
    }[];
    for (const p of players) {
      const espn = espnIdFromHeadshot(p.headshotUrl);
      const rating = espn ? ratings.get(espn) : undefined;
      if (!rating) { unmatched += 1; continue; }
      matched += 1;
      rows.push({
        playerId: p.id,
        positionGroup: ATTR_GROUP[rating.positionGroup],
        attributesJson: JSON.stringify({ ...rating.attributes, OVR: rating.overall }),
        weightedOverall: rating.overall,
      });
    }
  }
  console.log(`matched ${matched} players, ${unmatched} without a rating (em dash)`);

  if (!WRITE) {
    console.log("DRY RUN — pass --write to ingest. No data written.");
    return;
  }
  const cleared = (await client.mutation("sports:clearSeasonPlayerAttributes" as never, { seasonId: SEASON_ID } as never)) as { deleted: number };
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const res = (await client.mutation("sports:ingestPlayerAttributesBatch" as never, {
      seasonId: SEASON_ID, rows: rows.slice(i, i + 500),
    } as never)) as { created: number; updated: number };
    written += res.created + res.updated;
  }
  console.log(`cleared ${cleared.deleted}, wrote ${written}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
