import type { PlayerGameStatLine } from "@sports-management/shared-types";

/*
 * MaxPreps stat-import file generator (WSM-000112, PR4). Produces the documented
 * pipe-delimited `.txt`: Line 1 = 32-char Stat Supplier ID, Line 2 =
 * `Jersey|<exact MaxPreps field names>`, Lines 3+ = one row per player.
 * Spec + verbatim Football/Boys field names: docs/research/maxpreps-import-format.md §2a.
 *
 * Maps our internal PlayerGameStatLine groups → MaxPreps field names. A few of
 * our fields have no MaxPreps Football/Boys target and are intentionally omitted:
 *   passing.sacked, receiving.targets (no field), defense.defTd (MaxPreps splits
 *   Int/Fumble return TDs — our model lumps them, so we don't guess).
 * Column order follows the mapping below (a sensible offense→defense→ST→scoring).
 */

type Group = keyof PlayerGameStatLine;

// [our group, our field, MaxPreps field name] — order here is the column order.
const FIELD_MAP: ReadonlyArray<readonly [Group, string, string]> = [
  ["passing", "comp", "PassingComp"],
  ["passing", "att", "PassingAtt"],
  ["passing", "int", "PassingInt"],
  ["passing", "yards", "PassingYards"],
  ["passing", "td", "PassingTD"],
  ["rushing", "carries", "RushingNum"],
  ["rushing", "yards", "RushingYards"],
  ["rushing", "long", "RushingLong"],
  ["rushing", "td", "RushingTDNum"],
  ["receiving", "rec", "ReceivingNum"],
  ["receiving", "yards", "ReceivingYards"],
  ["receiving", "long", "ReceivingLong"],
  ["receiving", "td", "ReceivingTDNum"],
  ["defense", "tacklesSolo", "Tackles"],
  ["defense", "tacklesAst", "Assists"],
  ["defense", "tfl", "TacklesForLoss"],
  ["defense", "sacks", "Sacks"],
  ["defense", "int", "INTs"],
  ["defense", "passDef", "PassesDefensed"],
  ["defense", "ff", "CausedFumbles"],
  ["defense", "fr", "FumbleRecoveries"],
  ["ballSecurity", "fumbles", "OffensiveFumbles"],
  ["ballSecurity", "fumblesLost", "OffensiveFumblesLost"],
  ["kicking", "fgMade", "FGMade"],
  ["kicking", "fgAtt", "FGAttempted"],
  ["kicking", "xpMade", "PATKickingMade"],
  ["kicking", "xpAtt", "PATKickingAtt"],
  ["punting", "punts", "PuntNum"],
  ["punting", "yards", "PuntYards"],
  ["punting", "long", "PuntLong"],
  ["returns", "krCount", "KickoffReturnNum"],
  ["returns", "krYards", "KickoffReturnYards"],
  ["returns", "krTd", "KickoffReturnedTDNum"],
  ["returns", "prCount", "PuntReturnNum"],
  ["returns", "prYards", "PuntReturnYards"],
  ["returns", "prTd", "PuntReturnedTDNum"],
];

export const SUPPLIER_ID_PLACEHOLDER = "REPLACE_WITH_32_CHAR_SUPPLIER_ID";

export interface MaxPrepsExportRow {
  jersey: number;
  stats: PlayerGameStatLine;
}

/** Flatten a stat line to its MaxPreps field→value pairs (present fields only). */
export function mapStatLineToMaxPreps(
  line: PlayerGameStatLine,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [group, field, maxField] of FIELD_MAP) {
    const groupStats = line[group] as Record<string, number> | undefined;
    const value = groupStats?.[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[maxField] = value;
    }
  }
  return out;
}

export interface GenerateResult {
  /** The file contents. */
  text: string;
  /** Players included (had a jersey number + at least one mappable stat). */
  rowCount: number;
}

/**
 * Build the MaxPreps import file. Only players with a jersey number and at least
 * one mappable stat are included (MaxPreps keys rows by Jersey). The header lists
 * only the columns at least one player has data for; a player missing a column
 * gets a blank cell (per spec: undeclared fields aren't overwritten).
 */
export function generateMaxPrepsTxt(
  supplierId: string,
  rows: MaxPrepsExportRow[],
): GenerateResult {
  const mapped = rows
    .map((r) => ({ jersey: r.jersey, fields: mapStatLineToMaxPreps(r.stats) }))
    .filter((r) => Object.keys(r.fields).length > 0);

  // Columns = MaxPreps fields present on at least one player, in mapping order.
  const present = new Set<string>();
  for (const r of mapped) for (const k of Object.keys(r.fields)) present.add(k);
  const columns = FIELD_MAP.map(([, , maxField]) => maxField).filter(
    (f, i, arr) => arr.indexOf(f) === i && present.has(f),
  );

  const header = ["Jersey", ...columns].join("|");
  const playerLines = mapped.map((r) =>
    [
      String(r.jersey),
      ...columns.map((c) => (c in r.fields ? String(r.fields[c]) : "")),
    ].join("|"),
  );

  return {
    text: [supplierId, header, ...playerLines].join("\n"),
    rowCount: mapped.length,
  };
}
