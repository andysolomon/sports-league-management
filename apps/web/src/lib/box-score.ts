import type {
  PlayerGameStatLine,
  PlayerGameStatsDto,
} from "@sports-management/shared-types";
import { STAT_GROUPS, type StatFieldDef } from "./stat-groups";

/*
 * Read-only box-score tables (WSM-000212). Turns one team's entered stat lines
 * for a game into per-category tables using the same group/field definitions
 * the entry form uses (stat-groups.ts), so labels and column order match what
 * the stat-keeper saw.
 */

export interface BoxScorePlayerInfo {
  name: string;
  jerseyNumber: number | null;
}

export interface BoxScoreRow {
  playerId: string;
  playerName: string;
  jerseyNumber: number | null;
  /** One value per field in the group's field order; null = not entered. */
  values: Array<number | null>;
}

export interface BoxScoreGroupTable {
  key: keyof PlayerGameStatLine;
  label: string;
  fields: StatFieldDef[];
  rows: BoxScoreRow[];
}

/**
 * Build per-category tables for ONE team from that team's stat lines. Groups
 * with no entered lines are omitted; rows sort by the group's first field
 * descending (e.g. Comp for passing, Car for rushing) so the busiest player
 * leads the table.
 */
export function buildBoxScoreTables(
  stats: PlayerGameStatsDto[],
  playersById: Map<string, BoxScorePlayerInfo>,
): BoxScoreGroupTable[] {
  const tables: BoxScoreGroupTable[] = [];

  for (const group of STAT_GROUPS) {
    const rows: BoxScoreRow[] = [];
    for (const line of stats) {
      const groupStats = line.stats[group.key] as
        | Record<string, number | undefined>
        | undefined;
      if (!groupStats) continue;
      const values = group.fields.map((f) => groupStats[f.key] ?? null);
      if (values.every((v) => v === null)) continue;

      const info = playersById.get(line.playerId);
      rows.push({
        playerId: line.playerId,
        playerName: info?.name ?? "Unknown player",
        jerseyNumber: info?.jerseyNumber ?? null,
        values,
      });
    }
    if (rows.length === 0) continue;

    rows.sort((a, b) => (b.values[0] ?? 0) - (a.values[0] ?? 0));
    tables.push({
      key: group.key,
      label: group.label,
      fields: group.fields,
      rows,
    });
  }

  return tables;
}
