/*
 * HS SPRT rating from real game stats (WSM-000112, PR5). Same idea as the
 * nflverse SPRT model (z-score per position group → 0–99, centered 70), but the
 * components use ONLY box-score stats a stat-keeper actually enters — HS games
 * have no EPA. Pure + unit-tested; consumed by the computeSeasonSprt query,
 * which feeds it season aggregates from playerGameStats.
 *
 * Ratings are RELATIVE within a season's cohort: each component is z-scored
 * across qualified players at the same group, so it needs ≥2 of them; groups
 * with fewer are skipped (caller shows no rating).
 */

export type RatingGroup = "QB" | "RB" | "WR" | "TE" | "DL" | "LB" | "DB";

type StatLine = Record<string, Record<string, number>>;

const g = (line: StatLine, group: string, field: string): number =>
  line[group]?.[field] ?? 0;
const perGame = (total: number, games: number) => (games > 0 ? total / games : 0);
const rate = (num: number, den: number) => (den > 0 ? num / den : 0);

interface Component {
  key: string;
  value: number;
  weight: number;
}

const MODELS: Record<
  RatingGroup,
  { minGames: number; components: (l: StatLine, games: number) => Component[] }
> = {
  QB: {
    minGames: 1,
    components: (l, games) => [
      { key: "efficiency", value: rate(g(l, "passing", "comp"), g(l, "passing", "att")), weight: 0.3 },
      { key: "production", value: perGame(g(l, "passing", "yards"), games), weight: 0.35 },
      { key: "scoring", value: perGame(g(l, "passing", "td") - 1.5 * g(l, "passing", "int"), games), weight: 0.25 },
      { key: "mobility", value: perGame(g(l, "rushing", "yards"), games), weight: 0.1 },
    ],
  },
  RB: {
    minGames: 1,
    components: (l, games) => [
      { key: "efficiency", value: rate(g(l, "rushing", "yards"), g(l, "rushing", "carries")), weight: 0.35 },
      { key: "volume", value: perGame(g(l, "rushing", "yards"), games), weight: 0.35 },
      { key: "scoring", value: perGame(g(l, "rushing", "td") + g(l, "receiving", "td"), games), weight: 0.2 },
      { key: "receiving", value: perGame(g(l, "receiving", "yards"), games), weight: 0.1 },
    ],
  },
  WR: {
    minGames: 1,
    components: (l, games) => [
      { key: "volume", value: perGame(g(l, "receiving", "yards"), games), weight: 0.45 },
      { key: "catches", value: perGame(g(l, "receiving", "rec"), games), weight: 0.3 },
      { key: "scoring", value: perGame(g(l, "receiving", "td"), games), weight: 0.25 },
    ],
  },
  TE: {
    minGames: 1,
    components: (l, games) => [
      { key: "volume", value: perGame(g(l, "receiving", "yards"), games), weight: 0.5 },
      { key: "catches", value: perGame(g(l, "receiving", "rec"), games), weight: 0.3 },
      { key: "scoring", value: perGame(g(l, "receiving", "td"), games), weight: 0.2 },
    ],
  },
  DL: {
    minGames: 1,
    components: (l, games) => [
      { key: "passRush", value: perGame(g(l, "defense", "sacks"), games), weight: 0.4 },
      { key: "runStop", value: perGame(g(l, "defense", "tfl"), games), weight: 0.3 },
      { key: "tackling", value: perGame(g(l, "defense", "tacklesSolo") + g(l, "defense", "tacklesAst"), games), weight: 0.3 },
    ],
  },
  LB: {
    minGames: 1,
    components: (l, games) => [
      { key: "tackling", value: perGame(g(l, "defense", "tacklesSolo") + g(l, "defense", "tacklesAst"), games), weight: 0.35 },
      { key: "passRush", value: perGame(g(l, "defense", "sacks"), games), weight: 0.25 },
      { key: "runStop", value: perGame(g(l, "defense", "tfl"), games), weight: 0.2 },
      { key: "coverage", value: perGame(g(l, "defense", "passDef") + g(l, "defense", "int"), games), weight: 0.2 },
    ],
  },
  DB: {
    minGames: 1,
    components: (l, games) => [
      { key: "coverage", value: perGame(g(l, "defense", "passDef"), games), weight: 0.4 },
      { key: "ballHawk", value: perGame(g(l, "defense", "int"), games), weight: 0.35 },
      { key: "tackling", value: perGame(g(l, "defense", "tacklesSolo") + g(l, "defense", "tacklesAst"), games), weight: 0.25 },
    ],
  },
};

const POSITION_TO_GROUP: Record<string, RatingGroup> = {
  QB: "QB",
  HB: "RB", RB: "RB", FB: "RB",
  WR: "WR",
  TE: "TE",
  DE: "DL", DT: "DL", NT: "DL", EDGE: "DL", DL: "DL",
  OLB: "LB", MLB: "LB", ILB: "LB", LB: "LB",
  CB: "DB", S: "DB", FS: "DB", SS: "DB", NB: "DB", DB: "DB",
};

/** Map a roster position to a rating group, or null (OL/K/unmapped — unrated). */
export function positionToRatingGroup(position: string): RatingGroup | null {
  return POSITION_TO_GROUP[position.trim().toUpperCase()] ?? null;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stdev(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}
/** z-score → 0–99, centered 70, ~12 pts per σ (matches the NFL SPRT scale). */
function zToRating(z: number): number {
  return Math.max(40, Math.min(99, Math.round(70 + 12 * z)));
}

export interface HsRatingInput {
  id: string;
  group: RatingGroup;
  totals: StatLine;
  games: number;
}

export interface HsRating {
  positionGroup: RatingGroup;
  overall: number;
  attributes: Record<string, number>;
}

export function computeHsSprtRatings(
  players: readonly HsRatingInput[],
): Map<string, HsRating> {
  const result = new Map<string, HsRating>();

  for (const group of Object.keys(MODELS) as RatingGroup[]) {
    const model = MODELS[group];
    const qualified = players.filter(
      (p) => p.group === group && p.games >= model.minGames,
    );
    if (qualified.length < 2) continue;

    const rows = qualified.map((p) => ({
      id: p.id,
      components: model.components(p.totals, p.games),
    }));
    const keys = rows[0].components.map((c) => c.key);
    const stats: Record<string, { m: number; sd: number; w: number }> = {};
    for (let i = 0; i < keys.length; i++) {
      const vals = rows.map((r) => r.components[i].value);
      const m = mean(vals);
      stats[keys[i]] = { m, sd: stdev(vals, m), w: rows[0].components[i].weight };
    }

    for (const row of rows) {
      const attributes: Record<string, number> = {};
      let overallZ = 0;
      for (const c of row.components) {
        const { m, sd, w } = stats[c.key];
        const z = sd > 0 ? (c.value - m) / sd : 0;
        attributes[c.key] = zToRating(z);
        overallZ += w * z;
      }
      result.set(row.id, { positionGroup: group, overall: zToRating(overallZ), attributes });
    }
  }

  return result;
}
