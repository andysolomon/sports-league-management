import type { PlayerDto } from "@sports-management/shared-types";

export type PlayersViewMode = "cards" | "list";
export type PositionSideGroup = "all" | "off" | "def" | "st";

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

export const POSITION_SIDE_GROUPS: ReadonlyArray<{
  value: PositionSideGroup;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "off", label: "Offense" },
  { value: "def", label: "Defense" },
  { value: "st", label: "Special" },
];

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

export function positionSideGroup(position: string): "off" | "def" | "st" | null {
  const pos = position.trim().toUpperCase();
  if (OFFENSE_POSITIONS.has(pos)) return "off";
  if (DEFENSE_POSITIONS.has(pos)) return "def";
  if (SPECIAL_POSITIONS.has(pos)) return "st";
  return null;
}

export function matchesPositionSideGroup(
  position: string,
  group: PositionSideGroup,
): boolean {
  if (group === "all") return true;
  return positionSideGroup(position) === group;
}

export function filterPlayers(
  players: readonly DirectoryPlayer[],
  query: string,
  group: PositionSideGroup,
): DirectoryPlayer[] {
  const q = query.trim().toLowerCase();
  return players.filter(
    (player) =>
      matchesPositionSideGroup(player.position, group) &&
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
