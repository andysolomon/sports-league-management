import type { PlayerDto } from "@sports-management/shared-types";
import {
  derivePositionGroup,
  OTHER_GROUP,
  POSITION_GROUP_ORDER,
  type RosterGroup,
} from "@/lib/position-group";

export type PlayersViewMode = "cards" | "list";
export type PositionSide = "off" | "def" | "st";
/** Directory filter: every position group present in the data, plus "all". */
export type PositionFilter = "all" | RosterGroup;

export type PlayerSortKey =
  | "name"
  | "team"
  | "pos"
  | "num"
  | "rating"
  | "status";

export interface PlayerSort {
  key: PlayerSortKey;
  dir: "asc" | "desc";
}

export const PLAYERS_PAGE_SIZE: Record<PlayersViewMode, number> = {
  cards: 24,
  list: 25,
};

const OFFENSE_POSITIONS = new Set([
  "QB",
  "RB",
  "HB",
  "FB",
  "WR",
  "TE",
  "LT",
  "LG",
  "C",
  "RG",
  "RT",
  "G",
  "OG",
  "OT",
  "OL",
]);

const DEFENSE_POSITIONS = new Set([
  "DE",
  "DT",
  "NT",
  "EDGE",
  "DL",
  "OLB",
  "MLB",
  "ILB",
  "LB",
  "CB",
  "S",
  "FS",
  "SS",
  "NB",
  "DB",
]);

const SPECIAL_POSITIONS = new Set(["K", "PK", "P", "LS"]);

export interface DirectoryPlayer extends PlayerDto {
  teamName: string;
  teamPrimaryColor: string | null;
  overallRating: number | null;
}

/**
 * Which side of the ball a position plays. Drives colour coding only — the
 * directory filters by position group, so this no longer gates visibility.
 */
export function positionSide(position: string): PositionSide | null {
  const pos = position.trim().toUpperCase();
  if (OFFENSE_POSITIONS.has(pos)) return "off";
  if (DEFENSE_POSITIONS.has(pos)) return "def";
  if (SPECIAL_POSITIONS.has(pos)) return "st";
  return null;
}

/** The filter bucket a player falls into — their group, or "Other". */
export function playerPositionGroup(position: string): RosterGroup {
  return derivePositionGroup(position) ?? OTHER_GROUP;
}

export function matchesPositionFilter(
  position: string,
  filter: PositionFilter,
): boolean {
  if (filter === "all") return true;
  return playerPositionGroup(position) === filter;
}

/**
 * Filter chips for the directory: "All" plus every position group that is
 * actually represented, in canonical football order with "Other" last. Groups
 * with no players are omitted rather than shown as dead zero-count chips.
 */
export function buildPositionFilterOptions(
  players: readonly DirectoryPlayer[],
): Array<{ value: PositionFilter; label: string; count: number }> {
  const counts = new Map<RosterGroup, number>();
  for (const player of players) {
    const group = playerPositionGroup(player.position);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  const ordered: RosterGroup[] = [...POSITION_GROUP_ORDER, OTHER_GROUP];
  return [
    { value: "all" as const, label: "All", count: players.length },
    ...ordered
      .filter((group) => (counts.get(group) ?? 0) > 0)
      .map((group) => ({
        value: group as PositionFilter,
        label: group,
        count: counts.get(group) ?? 0,
      })),
  ];
}

export function filterPlayers(
  players: readonly DirectoryPlayer[],
  query: string,
  filter: PositionFilter,
): DirectoryPlayer[] {
  const q = query.trim().toLowerCase();
  return players.filter(
    (player) =>
      matchesPositionFilter(player.position, filter) &&
      (!q ||
        player.name.toLowerCase().includes(q) ||
        player.teamName.toLowerCase().includes(q) ||
        player.position.toLowerCase().includes(q)),
  );
}

export function sortPlayers(
  players: readonly DirectoryPlayer[],
  sort: PlayerSort,
): DirectoryPlayer[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...players].sort((a, b) => {
    let av: string | number | null;
    let bv: string | number | null;
    switch (sort.key) {
      case "name":
        av = a.name;
        bv = b.name;
        break;
      case "team":
        av = a.teamName;
        bv = b.teamName;
        break;
      case "pos":
        av = a.position;
        bv = b.position;
        break;
      case "num":
        av = a.jerseyNumber;
        bv = b.jerseyNumber;
        break;
      case "status":
        av = a.status;
        bv = b.status;
        break;
      default:
        av = a.overallRating;
        bv = b.overallRating;
    }

    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * dir || a.name.localeCompare(b.name);
    }

    const aNum =
      typeof av === "number" ? av : Number.NEGATIVE_INFINITY;
    const bNum =
      typeof bv === "number" ? bv : Number.NEGATIVE_INFINITY;
    return (aNum - bNum) * dir || (b.overallRating ?? 0) - (a.overallRating ?? 0);
  });
}

export function paginatePlayers<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): {
  pageItems: T[];
  total: number;
  totalPages: number;
  safePage: number;
  startIndex: number;
} {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  return {
    pageItems: items.slice(startIndex, startIndex + pageSize),
    total,
    totalPages,
    safePage,
    startIndex,
  };
}
