import type { PlayerDto } from "@sports-management/shared-types";

/**
 * Orders a position group by depth so slot 1 is the starter: highest SPRT
 * OVR first, unrated players after, ties broken by ascending jersey number.
 * `getOvr` returns the player's OVR or null when unrated. Pure — never mutates
 * the input array.
 *
 * Without this, a group followed roster-insertion order (effectively jersey
 * number), which buried a high-numbered starter like a #17 QB below unrated
 * backups (WSM-000088 follow-up).
 */
export function orderByDepth(
  players: PlayerDto[],
  getOvr: (player: PlayerDto) => number | null,
): PlayerDto[] {
  return [...players].sort((a, b) => {
    const aOvr = getOvr(a);
    const bOvr = getOvr(b);
    if (aOvr !== bOvr) {
      if (aOvr == null) return 1;
      if (bOvr == null) return -1;
      return bOvr - aOvr;
    }
    return (a.jerseyNumber ?? Infinity) - (b.jerseyNumber ?? Infinity);
  });
}
