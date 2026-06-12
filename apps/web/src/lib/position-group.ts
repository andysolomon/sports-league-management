export type PositionGroup =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "OL"
  | "DL"
  | "LB"
  | "DB"
  | "K/P";

/** Bucket for positions `derivePositionGroup` can't map — shown last, never dropped. */
export const OTHER_GROUP = "Other" as const;
export type RosterGroup = PositionGroup | typeof OTHER_GROUP;

const POSITION_TO_GROUP: Readonly<Record<string, PositionGroup>> = {
  QB: "QB",
  HB: "RB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  LT: "OL",
  LG: "OL",
  C: "OL",
  RG: "OL",
  RT: "OL",
  G: "OL",
  OG: "OL",
  OT: "OL",
  OL: "OL",
  DE: "DL",
  DT: "DL",
  NT: "DL",
  EDGE: "DL",
  DL: "DL",
  OLB: "LB",
  MLB: "LB",
  ILB: "LB",
  LB: "LB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
  NB: "DB",
  DB: "DB",
  K: "K/P",
  PK: "K/P",
  P: "K/P",
  LS: "K/P",
};

/** Canonical football ordering — offense, defense, special teams. */
export const POSITION_GROUP_ORDER: readonly PositionGroup[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "DB",
  "K/P",
];

/**
 * Display order of positions inside a group (e.g. the offensive line reads
 * left-to-right). Positions absent from their group's list sort after the
 * listed ones, alphabetically.
 */
const POSITION_ORDER_IN_GROUP: Readonly<Partial<Record<PositionGroup, readonly string[]>>> = {
  RB: ["HB", "RB", "FB"],
  OL: ["LT", "LG", "C", "RG", "RT", "G", "OG", "OT", "OL"],
  DL: ["DE", "EDGE", "DT", "NT", "DL"],
  LB: ["OLB", "MLB", "ILB", "LB"],
  DB: ["CB", "NB", "FS", "SS", "S", "DB"],
  "K/P": ["K", "PK", "P", "LS"],
};

export function derivePositionGroup(position: string): PositionGroup | null {
  const normalized = position.trim().toUpperCase();
  return POSITION_TO_GROUP[normalized] ?? null;
}

interface Positioned {
  position: string;
  jerseyNumber?: number | null;
  name: string;
}

export interface GroupedRoster<T extends Positioned> {
  group: RosterGroup;
  players: T[];
}

function positionRank(group: RosterGroup, position: string): number {
  if (group === OTHER_GROUP) return 0;
  const order = POSITION_ORDER_IN_GROUP[group];
  if (!order) return 0;
  const idx = order.indexOf(position.trim().toUpperCase());
  return idx === -1 ? order.length : idx;
}

/**
 * Groups players into Madden-style position groups, ordered QB → RB → WR →
 * TE → OL → DL → LB → DB → K/P, with unmappable positions in a trailing
 * "Other" group. Within a group: position order, then jersey number, then
 * name. Empty groups are omitted.
 */
export function groupPlayersByPosition<T extends Positioned>(
  players: readonly T[],
): GroupedRoster<T>[] {
  const buckets = new Map<RosterGroup, T[]>();
  for (const player of players) {
    const group = derivePositionGroup(player.position) ?? OTHER_GROUP;
    const bucket = buckets.get(group);
    if (bucket) bucket.push(player);
    else buckets.set(group, [player]);
  }

  const orderedGroups: RosterGroup[] = [...POSITION_GROUP_ORDER, OTHER_GROUP];
  const result: GroupedRoster<T>[] = [];
  for (const group of orderedGroups) {
    const bucket = buckets.get(group);
    if (!bucket) continue;
    bucket.sort((a, b) => {
      const rankDiff =
        positionRank(group, a.position) - positionRank(group, b.position);
      if (rankDiff !== 0) return rankDiff;
      const aJersey = a.jerseyNumber ?? Number.MAX_SAFE_INTEGER;
      const bJersey = b.jerseyNumber ?? Number.MAX_SAFE_INTEGER;
      if (aJersey !== bJersey) return aJersey - bJersey;
      return a.name.localeCompare(b.name);
    });
    result.push({ group, players: bucket });
  }
  return result;
}
