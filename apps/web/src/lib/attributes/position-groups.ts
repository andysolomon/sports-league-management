/**
 * Canonical position-group taxonomy for player attributes (Phase 2 /
 * `player_attributes_v1`). Mirrors the broader player-position util
 * in `apps/web/convex/lib/positionGroup.ts` but is scoped to the
 * attribute domain — every `playerAttributes` row carries a
 * positionGroup matching one of these literals.
 */
export const POSITION_GROUPS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "DB",
  "K",
  "P",
] as const;

export type PositionGroup = (typeof POSITION_GROUPS)[number];

export function isValidPositionGroup(s: unknown): s is PositionGroup {
  return typeof s === "string" && (POSITION_GROUPS as readonly string[]).includes(s);
}
