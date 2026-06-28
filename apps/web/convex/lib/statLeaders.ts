/*
 * Season stat-leaders (WSM-000186) — pure ranking over aggregated box-score
 * totals. `getSeasonStatLeaders` in sports.ts gathers each player's season
 * totals (via aggregateStatLines), flattens them to the per-category scalars
 * below, and calls computeStatLeaders. Kept dependency-light (operates on the
 * parsed JSON shape, no cross-package import) so it stays in the Convex bundle
 * and is trivially unit-testable.
 */

type StatGroup = Record<string, number>;
type StatLine = Record<string, StatGroup>;

export interface LeaderCategory {
  key: string;
  label: string;
}

/** The leaderboard categories a HS football coach/fan expects, in display order. */
export const LEADER_CATEGORIES: readonly LeaderCategory[] = [
  { key: "passYards", label: "Passing yards" },
  { key: "passTD", label: "Passing TDs" },
  { key: "rushYards", label: "Rushing yards" },
  { key: "rushTD", label: "Rushing TDs" },
  { key: "recYards", label: "Receiving yards" },
  { key: "receptions", label: "Receptions" },
  { key: "tackles", label: "Tackles" },
  { key: "sacks", label: "Sacks" },
  { key: "interceptions", label: "Interceptions" },
];

function num(group: StatGroup | undefined, field: string): number {
  const v = group?.[field];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Flatten an aggregated season stat line to the leaderboard scalar per category. */
export function categoryValues(totals: StatLine): Record<string, number> {
  return {
    passYards: num(totals.passing, "yards"),
    passTD: num(totals.passing, "td"),
    rushYards: num(totals.rushing, "yards"),
    rushTD: num(totals.rushing, "td"),
    recYards: num(totals.receiving, "yards"),
    receptions: num(totals.receiving, "rec"),
    // Total tackles = solo + assisted.
    tackles: num(totals.defense, "tacklesSolo") + num(totals.defense, "tacklesAst"),
    sacks: num(totals.defense, "sacks"),
    interceptions: num(totals.defense, "int"),
  };
}

export interface LeaderInput {
  playerId: string;
  playerName: string;
  teamName: string;
  jerseyNumber: number | null;
  values: Record<string, number>;
}

export interface LeaderEntry {
  playerId: string;
  playerName: string;
  teamName: string;
  jerseyNumber: number | null;
  value: number;
}

export interface CategoryLeaders {
  key: string;
  label: string;
  leaders: LeaderEntry[];
}

/**
 * Rank players within each category: descending by value, ties broken by name
 * (stable + deterministic), zero values excluded, top `topN` kept. Every
 * category is returned (even if empty) so the board renders a consistent grid.
 */
export function computeStatLeaders(
  players: readonly LeaderInput[],
  topN = 5,
): CategoryLeaders[] {
  return LEADER_CATEGORIES.map((cat) => {
    const leaders = players
      .map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        teamName: p.teamName,
        jerseyNumber: p.jerseyNumber,
        value: p.values[cat.key] ?? 0,
      }))
      .filter((e) => e.value > 0)
      .sort(
        (a, b) => b.value - a.value || a.playerName.localeCompare(b.playerName),
      )
      .slice(0, topN);
    return { key: cat.key, label: cat.label, leaders };
  });
}
