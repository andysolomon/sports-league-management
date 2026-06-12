/**
 * SPRT Rating ingest (WSM-000091).
 *
 * Pulls a completed season's open NFL data from nflverse (player_stats +
 * rosters — published release assets, not scraped), computes our own SPRT
 * ratings, matches nflverse players to our roster via ESPN id, and loads
 * them through ingestPlayerAttributesBatch. Dry-run by default; pass
 * --write to actually ingest.
 *
 * Usage:
 *   npx tsx apps/web/scripts/ingest-sprt-ratings.mts \
 *     --season-id <convexSeasonId> --league-id <convexLeagueId> \
 *     --data-year 2024 [--prod] [--write]
 *
 * Player → ESPN id: our players store ESPN headshot URLs like
 * .../full/4870808.png; nflverse rosters carry espn_id. We join on that,
 * falling back to normalized name within the same team.
 */
import { ConvexHttpClient } from "convex/browser";
import {
  computeSprtRatings,
  type SeasonStatLine,
  type RatingPositionGroup,
} from "../src/lib/ratings/sprt.js";

const NFLVERSE = "https://github.com/nflverse/nflverse-data/releases/download";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const SEASON_ID = arg("season-id");
const LEAGUE_ID = arg("league-id");
// Default to the most recent completed season. nflverse publishes the
// unified stats_player_week_<year>.csv (offense + defense in one file)
// for 2025+; older years used separate player_stats files.
const DATA_YEAR = arg("data-year") ?? "2025";
const WRITE = has("write");

if (!SEASON_ID || !LEAGUE_ID) {
  console.error("Required: --season-id <id> --league-id <id>");
  process.exit(1);
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const ADMIN_KEY = process.env.CONVEX_ADMIN_KEY;
if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is required.");
  process.exit(1);
}

const GROUP_MAP: Record<string, RatingPositionGroup> = {
  QB: "QB",
  RB: "RB", HB: "RB", FB: "RB",
  WR: "WR",
  TE: "TE",
  DE: "DL", DT: "DL", NT: "DL", EDGE: "DL", DL: "DL",
  OLB: "LB", MLB: "LB", ILB: "LB", LB: "LB",
  CB: "DB", S: "DB", FS: "DB", SS: "DB", NB: "DB", DB: "DB",
};

const ATTR_GROUP: Record<RatingPositionGroup, string> = {
  QB: "QB", RB: "RB", WR: "WR", TE: "TE", DL: "DL", LB: "LB", DB: "DB",
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`nflverse fetch ${res.status}: ${url}`);
  return parseCsv(await res.text());
}

const num = (s: string | undefined) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const normName = (s: string) =>
  s.toLowerCase().replace(/[^a-z]/g, "");

const espnIdFromHeadshot = (url: string | null): string | null => {
  if (!url) return null;
  const m = url.match(/\/(\d+)\.png/);
  return m ? m[1] : null;
};

async function main() {
  console.log(`SPRT ingest — data year ${DATA_YEAR}, ${WRITE ? "WRITE" : "DRY RUN"}`);

  // 1. nflverse data — unified weekly stats (offense + defense) + rosters
  const [weekly, rosters] = await Promise.all([
    fetchCsv(`${NFLVERSE}/stats_player/stats_player_week_${DATA_YEAR}.csv`),
    fetchCsv(`${NFLVERSE}/rosters/roster_${DATA_YEAR}.csv`),
  ]);
  console.log(`nflverse: ${weekly.length} weekly stat rows, ${rosters.length} roster rows`);

  // 2. espn_id → gsis_id (player_id) from rosters
  const gsisToEspn = new Map<string, string>();
  for (const r of rosters) {
    if (r.gsis_id && r.espn_id) gsisToEspn.set(r.gsis_id, r.espn_id);
  }

  // 3. aggregate season stat lines per gsis player_id
  const lines = new Map<string, SeasonStatLine & { position: string }>();
  const acc = (id: string, pos: string) => {
    let l = lines.get(id);
    if (!l) { l = { games: 0, position: pos } as SeasonStatLine & { position: string }; lines.set(id, l); }
    return l;
  };
  // Unified file: one row per player per week carries both offense and
  // defense columns. We count a game once and accumulate every stat.
  for (const r of weekly) {
    if (r.season_type !== "REG") continue;
    const l = acc(r.player_id, r.position);
    l.games += 1;
    l.passingEpa = (l.passingEpa ?? 0) + num(r.passing_epa);
    l.passingYards = (l.passingYards ?? 0) + num(r.passing_yards);
    l.passingTds = (l.passingTds ?? 0) + num(r.passing_tds);
    l.interceptions = (l.interceptions ?? 0) + num(r.passing_interceptions);
    l.carries = (l.carries ?? 0) + num(r.carries);
    l.rushingYards = (l.rushingYards ?? 0) + num(r.rushing_yards);
    l.rushingTds = (l.rushingTds ?? 0) + num(r.rushing_tds);
    l.rushingEpa = (l.rushingEpa ?? 0) + num(r.rushing_epa);
    l.receptions = (l.receptions ?? 0) + num(r.receptions);
    l.targets = (l.targets ?? 0) + num(r.targets);
    l.receivingYards = (l.receivingYards ?? 0) + num(r.receiving_yards);
    l.receivingTds = (l.receivingTds ?? 0) + num(r.receiving_tds);
    l.receivingEpa = (l.receivingEpa ?? 0) + num(r.receiving_epa);
    l.receivingYac = (l.receivingYac ?? 0) + num(r.receiving_yards_after_catch);
    // 2025 splits tackles into solo + assists (no single def_tackles).
    l.defTackles =
      (l.defTackles ?? 0) + num(r.def_tackles_solo) + num(r.def_tackle_assists);
    l.defSacks = (l.defSacks ?? 0) + num(r.def_sacks);
    l.defQbHits = (l.defQbHits ?? 0) + num(r.def_qb_hits);
    l.defInterceptions = (l.defInterceptions ?? 0) + num(r.def_interceptions);
    l.defPassDefended = (l.defPassDefended ?? 0) + num(r.def_pass_defended);
    l.defTacklesForLoss = (l.defTacklesForLoss ?? 0) + num(r.def_tackles_for_loss);
  }

  // 4. build rating inputs keyed by espn_id
  const byEspn = new Map<string, { group: RatingPositionGroup; stats: SeasonStatLine }>();
  for (const [gsis, line] of lines) {
    const espn = gsisToEspn.get(gsis);
    const group = GROUP_MAP[(line.position ?? "").toUpperCase()];
    if (!espn || !group) continue;
    byEspn.set(espn, { group, stats: line });
  }
  const ratings = computeSprtRatings(
    [...byEspn.entries()].map(([id, v]) => ({ id, group: v.group, stats: v.stats })),
  );
  console.log(`computed ${ratings.size} SPRT ratings (qualified, by espn_id)`);

  // 5. match to our roster
  const client = new ConvexHttpClient(CONVEX_URL);
  if (ADMIN_KEY) (client as unknown as { setAdminAuth: (k: string) => void }).setAdminAuth(ADMIN_KEY);
  const teams = (await client.query("sports:listTeamsByLeague" as never, { leagueId: LEAGUE_ID } as never)) as { id: string }[];

  const rows: { playerId: string; positionGroup: string; attributesJson: string; weightedOverall: number | null }[] = [];
  let matched = 0, unmatched = 0;
  for (const team of teams) {
    const players = (await client.query("sports:listPlayersByTeam" as never, { teamId: team.id } as never)) as {
      id: string; name: string; headshotUrl: string | null;
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
  const sample = rows.slice(0, 5).map((r) => `${r.weightedOverall} ${r.positionGroup}`);
  console.log("sample overalls:", sample.join(", "));

  if (!WRITE) {
    console.log("DRY RUN — pass --write to ingest. No data written.");
    return;
  }
  let created = 0, updated = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = (await client.mutation("sports:ingestPlayerAttributesBatch" as never, {
      seasonId: SEASON_ID, rows: chunk,
    } as never)) as { created: number; updated: number };
    created += res.created; updated += res.updated;
  }
  console.log(`INGESTED created=${created} updated=${updated}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
