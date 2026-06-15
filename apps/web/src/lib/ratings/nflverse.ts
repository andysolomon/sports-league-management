/**
 * nflverse data acquisition for the SPRT rating engine (WSM-000091/92).
 *
 * Fetches a season's open, permissively-licensed NFL production data
 * (published release assets — not scraped) and computes SPRT ratings
 * keyed by ESPN player id, so callers can join to our ESPN-sourced
 * roster. Shared by the CLI ingest script and the weekly cron.
 */
import {
  computeSprtRatings,
  type SeasonStatLine,
  type RatingPositionGroup,
  type SprtRating,
} from "./sprt";

const NFLVERSE =
  "https://github.com/nflverse/nflverse-data/releases/download";

const GROUP_MAP: Record<string, RatingPositionGroup> = {
  QB: "QB",
  RB: "RB", HB: "RB", FB: "RB",
  WR: "WR",
  TE: "TE",
  DE: "DL", DT: "DL", NT: "DL", EDGE: "DL", DL: "DL",
  OLB: "LB", MLB: "LB", ILB: "LB", LB: "LB",
  CB: "DB", S: "DB", FS: "DB", SS: "DB", NB: "DB", DB: "DB",
};

/** Roster `attributes.positionGroup` literals (K/P excluded from SPRT). */
export const ATTR_GROUP: Record<RatingPositionGroup, string> = {
  QB: "QB", RB: "RB", WR: "WR", TE: "TE", DL: "DL", LB: "LB", DB: "DB",
};

/** Our players store ESPN headshot URLs like .../full/4870808.png. */
export function espnIdFromHeadshot(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/(\d+)\.png/);
  return m ? m[1] : null;
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

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

async function fetchCsv(url: string): Promise<Record<string, string>[] | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`nflverse fetch ${res.status}: ${url}`);
  return parseCsv(await res.text());
}

const num = (s: string | undefined) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * The latest nflverse season year whose unified weekly stats asset
 * exists, probing `currentYear` then `currentYear - 1`. In-season the
 * current year is present and grows weekly; off-season it falls back to
 * the prior completed season. Returns null if neither exists.
 */
export async function resolveLatestDataYear(
  currentYear: number,
): Promise<number | null> {
  for (const year of [currentYear, currentYear - 1]) {
    const res = await fetch(
      `${NFLVERSE}/stats_player/stats_player_week_${year}.csv`,
      { method: "HEAD" },
    );
    if (res.ok) return year;
  }
  return null;
}

/**
 * Fetches the season's data and returns SPRT ratings keyed by ESPN id.
 */
export async function fetchSprtRatingsByEspnId(
  dataYear: number,
): Promise<Map<string, SprtRating>> {
  const [weekly, rosters] = await Promise.all([
    fetchCsv(`${NFLVERSE}/stats_player/stats_player_week_${dataYear}.csv`),
    fetchCsv(`${NFLVERSE}/rosters/roster_${dataYear}.csv`),
  ]);
  if (!weekly || !rosters) {
    throw new Error(`nflverse data missing for ${dataYear}`);
  }

  const gsisToEspn = new Map<string, string>();
  for (const r of rosters) {
    if (r.gsis_id && r.espn_id) gsisToEspn.set(r.gsis_id, r.espn_id);
  }

  const lines = new Map<string, SeasonStatLine & { position: string }>();
  const acc = (id: string, pos: string) => {
    let l = lines.get(id);
    if (!l) {
      l = { games: 0, position: pos } as SeasonStatLine & { position: string };
      lines.set(id, l);
    }
    return l;
  };
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
    l.receivingYac =
      (l.receivingYac ?? 0) + num(r.receiving_yards_after_catch);
    l.defTackles =
      (l.defTackles ?? 0) + num(r.def_tackles_solo) + num(r.def_tackle_assists);
    l.defSacks = (l.defSacks ?? 0) + num(r.def_sacks);
    l.defQbHits = (l.defQbHits ?? 0) + num(r.def_qb_hits);
    l.defInterceptions = (l.defInterceptions ?? 0) + num(r.def_interceptions);
    l.defPassDefended = (l.defPassDefended ?? 0) + num(r.def_pass_defended);
    l.defTacklesForLoss =
      (l.defTacklesForLoss ?? 0) + num(r.def_tackles_for_loss);
  }

  const inputs: { id: string; group: RatingPositionGroup; stats: SeasonStatLine }[] = [];
  for (const [gsis, line] of lines) {
    const espn = gsisToEspn.get(gsis);
    const group = GROUP_MAP[(line.position ?? "").toUpperCase()];
    if (!espn || !group) continue;
    inputs.push({ id: espn, group, stats: line });
  }
  return computeSprtRatings(inputs);
}
