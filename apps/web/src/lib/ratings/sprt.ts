/**
 * SPRT Rating (WSM-000091) — our own player-rating system derived from
 * open, permissively-licensed NFL data (nflverse / nflfastR), NOT from
 * PFF or EA Madden. Inputs are box-score + EPA production aggregated
 * over a season; outputs are a 0–99 overall plus transparent component
 * sub-scores. Production-based, so a player needs real snaps to earn a
 * rating — low-sample players return null and render as an em dash.
 *
 * The model is intentionally simple and documented: each position group
 * has a small set of weighted components, each component is a z-score of
 * a per-game (or per-opportunity) stat across qualified players at that
 * group, blended and squashed onto 0–99. Pure and unit-tested; the
 * ingest script (scripts/ingest-sprt-ratings.mts) feeds it real data.
 */

export type RatingPositionGroup =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "DL"
  | "LB"
  | "DB";

/** Season-aggregated stat line for one player (sums unless noted). */
export interface SeasonStatLine {
  games: number;
  // Offense
  passingEpa?: number;
  passingYards?: number;
  passingTds?: number;
  interceptions?: number;
  completions?: number;
  attempts?: number;
  carries?: number;
  rushingYards?: number;
  rushingTds?: number;
  rushingEpa?: number;
  receptions?: number;
  targets?: number;
  receivingYards?: number;
  receivingTds?: number;
  receivingEpa?: number;
  receivingYac?: number;
  // Defense
  defTackles?: number;
  defSacks?: number;
  defQbHits?: number;
  defInterceptions?: number;
  defPassDefended?: number;
  defTacklesForLoss?: number;
}

export interface SprtComponent {
  key: string;
  /** Per-game or per-opportunity raw value used for ranking. */
  value: number;
  weight: number;
}

interface GroupModel {
  group: RatingPositionGroup;
  /** Minimum games to qualify for a rating. */
  minGames: number;
  /** Component extractors from a season line (per-game normalized). */
  components: (s: SeasonStatLine) => SprtComponent[];
}

const perGame = (total: number | undefined, games: number) =>
  games > 0 ? (total ?? 0) / games : 0;

const ratePct = (num: number | undefined, den: number | undefined) =>
  den && den > 0 ? (num ?? 0) / den : 0;

const GROUP_MODELS: Record<RatingPositionGroup, GroupModel> = {
  QB: {
    group: "QB",
    minGames: 4,
    components: (s) => [
      { key: "efficiency", value: s.passingEpa ?? 0, weight: 0.45 },
      { key: "production", value: perGame(s.passingYards, s.games), weight: 0.25 },
      {
        key: "scoring",
        value: (s.passingTds ?? 0) - 1.5 * (s.interceptions ?? 0),
        weight: 0.2,
      },
      { key: "mobility", value: s.rushingEpa ?? 0, weight: 0.1 },
    ],
  },
  RB: {
    group: "RB",
    minGames: 4,
    components: (s) => [
      { key: "rushEff", value: s.rushingEpa ?? 0, weight: 0.4 },
      { key: "volume", value: perGame(s.rushingYards, s.games), weight: 0.3 },
      { key: "receiving", value: s.receivingEpa ?? 0, weight: 0.2 },
      {
        key: "scoring",
        value: (s.rushingTds ?? 0) + (s.receivingTds ?? 0),
        weight: 0.1,
      },
    ],
  },
  WR: {
    group: "WR",
    minGames: 4,
    components: (s) => [
      { key: "efficiency", value: s.receivingEpa ?? 0, weight: 0.4 },
      { key: "volume", value: perGame(s.receivingYards, s.games), weight: 0.3 },
      { key: "explosiveness", value: perGame(s.receivingYac, s.games), weight: 0.15 },
      {
        key: "hands",
        value: ratePct(s.receptions, s.targets),
        weight: 0.15,
      },
    ],
  },
  TE: {
    group: "TE",
    minGames: 4,
    components: (s) => [
      { key: "efficiency", value: s.receivingEpa ?? 0, weight: 0.4 },
      { key: "volume", value: perGame(s.receivingYards, s.games), weight: 0.35 },
      { key: "hands", value: ratePct(s.receptions, s.targets), weight: 0.25 },
    ],
  },
  DL: {
    group: "DL",
    minGames: 4,
    components: (s) => [
      { key: "passRush", value: perGame(s.defSacks, s.games), weight: 0.4 },
      { key: "pressure", value: perGame(s.defQbHits, s.games), weight: 0.25 },
      { key: "runStop", value: perGame(s.defTacklesForLoss, s.games), weight: 0.2 },
      { key: "tackling", value: perGame(s.defTackles, s.games), weight: 0.15 },
    ],
  },
  LB: {
    group: "LB",
    minGames: 4,
    components: (s) => [
      { key: "tackling", value: perGame(s.defTackles, s.games), weight: 0.35 },
      { key: "passRush", value: perGame(s.defSacks, s.games), weight: 0.25 },
      { key: "runStop", value: perGame(s.defTacklesForLoss, s.games), weight: 0.2 },
      { key: "coverage", value: perGame(s.defPassDefended, s.games), weight: 0.2 },
    ],
  },
  DB: {
    group: "DB",
    minGames: 4,
    components: (s) => [
      { key: "coverage", value: perGame(s.defPassDefended, s.games), weight: 0.4 },
      { key: "ballHawk", value: perGame(s.defInterceptions, s.games), weight: 0.3 },
      { key: "tackling", value: perGame(s.defTackles, s.games), weight: 0.3 },
    ],
  },
};

export interface SprtRating {
  positionGroup: RatingPositionGroup;
  overall: number;
  attributes: Record<string, number>;
}

interface PlayerInput {
  id: string;
  group: RatingPositionGroup;
  stats: SeasonStatLine;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdev(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

/** z-score → 0–99, centered at 70, ~12 points per standard deviation. */
function zToRating(z: number): number {
  return Math.max(40, Math.min(99, Math.round(70 + 12 * z)));
}

/**
 * Computes SPRT ratings for a league of players. Ratings are relative —
 * each component is z-scored within its position group across qualified
 * players, so the output is a 0–99 distribution per group. Players below
 * a group's `minGames` are omitted (caller renders em dash).
 */
export function computeSprtRatings(
  players: readonly PlayerInput[],
): Map<string, SprtRating> {
  const result = new Map<string, SprtRating>();

  for (const group of Object.keys(GROUP_MODELS) as RatingPositionGroup[]) {
    const model = GROUP_MODELS[group];
    const qualified = players.filter(
      (p) => p.group === group && p.stats.games >= model.minGames,
    );
    if (qualified.length < 2) continue;

    const componentRows = qualified.map((p) => ({
      id: p.id,
      components: model.components(p.stats),
    }));

    // Per-component mean/stdev across qualified players.
    const keys = componentRows[0].components.map((c) => c.key);
    const stats: Record<string, { m: number; sd: number; w: number }> = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const vals = componentRows.map((r) => r.components[i].value);
      const m = mean(vals);
      stats[key] = { m, sd: stdev(vals, m), w: componentRows[0].components[i].weight };
    }

    for (const row of componentRows) {
      const attributes: Record<string, number> = {};
      let overallZ = 0;
      for (const c of row.components) {
        const { m, sd, w } = stats[c.key];
        const z = sd > 0 ? (c.value - m) / sd : 0;
        attributes[c.key] = zToRating(z);
        overallZ += w * z;
      }
      result.set(row.id, {
        positionGroup: group,
        overall: zToRating(overallZ),
        attributes,
      });
    }
  }

  return result;
}
