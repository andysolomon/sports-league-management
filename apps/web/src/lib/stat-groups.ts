import type { PlayerGameStatLine } from "@sports-management/shared-types";

/*
 * Form-driving config for box-score entry (WSM-000112, PR2). Maps the
 * PlayerGameStatLine groups (§6) to labeled numeric fields, and picks sensible
 * default groups per position so a stat-keeper sees the relevant sheet first
 * (any group can still be added manually).
 */

export interface StatFieldDef {
  key: string;
  label: string;
}

export interface StatGroupDef {
  key: keyof PlayerGameStatLine;
  label: string;
  fields: StatFieldDef[];
}

export const STAT_GROUPS: StatGroupDef[] = [
  {
    key: "passing",
    label: "Passing",
    fields: [
      { key: "comp", label: "Comp" },
      { key: "att", label: "Att" },
      { key: "yards", label: "Yds" },
      { key: "td", label: "TD" },
      { key: "int", label: "INT" },
      { key: "sacked", label: "Sacked" },
    ],
  },
  {
    key: "rushing",
    label: "Rushing",
    fields: [
      { key: "carries", label: "Car" },
      { key: "yards", label: "Yds" },
      { key: "td", label: "TD" },
      { key: "long", label: "Long" },
    ],
  },
  {
    key: "receiving",
    label: "Receiving",
    fields: [
      { key: "rec", label: "Rec" },
      { key: "yards", label: "Yds" },
      { key: "td", label: "TD" },
      { key: "long", label: "Long" },
      { key: "targets", label: "Tgt" },
    ],
  },
  {
    key: "defense",
    label: "Defense",
    fields: [
      { key: "tacklesSolo", label: "Solo" },
      { key: "tacklesAst", label: "Ast" },
      { key: "tfl", label: "TFL" },
      { key: "sacks", label: "Sacks" },
      { key: "int", label: "INT" },
      { key: "passDef", label: "PD" },
      { key: "ff", label: "FF" },
      { key: "fr", label: "FR" },
      { key: "defTd", label: "TD" },
    ],
  },
  {
    key: "kicking",
    label: "Kicking",
    fields: [
      { key: "fgMade", label: "FGM" },
      { key: "fgAtt", label: "FGA" },
      { key: "xpMade", label: "XPM" },
      { key: "xpAtt", label: "XPA" },
    ],
  },
  {
    key: "punting",
    label: "Punting",
    fields: [
      { key: "punts", label: "Punts" },
      { key: "yards", label: "Yds" },
      { key: "long", label: "Long" },
    ],
  },
  {
    key: "returns",
    label: "Returns",
    fields: [
      { key: "krCount", label: "KR" },
      { key: "krYards", label: "KR Yds" },
      { key: "krTd", label: "KR TD" },
      { key: "prCount", label: "PR" },
      { key: "prYards", label: "PR Yds" },
      { key: "prTd", label: "PR TD" },
    ],
  },
  {
    key: "ballSecurity",
    label: "Ball security",
    fields: [
      { key: "fumbles", label: "Fum" },
      { key: "fumblesLost", label: "Lost" },
    ],
  },
];

export const STAT_GROUP_BY_KEY: Record<string, StatGroupDef> = Object.fromEntries(
  STAT_GROUPS.map((g) => [g.key, g]),
);

const DEFAULTS_BY_GROUP: Record<string, Array<keyof PlayerGameStatLine>> = {
  QB: ["passing", "rushing"],
  RB: ["rushing", "receiving", "ballSecurity"],
  WR: ["receiving", "ballSecurity"],
  TE: ["receiving", "ballSecurity"],
  OL: [],
  DL: ["defense"],
  LB: ["defense"],
  DB: ["defense"],
  "K/P": ["kicking", "punting"],
};

/** Default stat groups to surface for a player's position group. */
export function defaultGroupsFor(
  positionGroup: string | null,
): Array<keyof PlayerGameStatLine> {
  if (positionGroup && positionGroup in DEFAULTS_BY_GROUP) {
    return DEFAULTS_BY_GROUP[positionGroup];
  }
  return [];
}
