/*
 * Pure live-scoring helpers (WSM-000152, keystone v3). Validation + the
 * scoring-event math, kept pure so the Convex mutations stay thin and this is
 * unit-testable (like lib/standings, lib/playerStats).
 */

export const LIVE_STATUSES = ["in_progress", "halftime", "final"] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];

export function isLiveStatus(s: string): s is LiveStatus {
  return (LIVE_STATUSES as readonly string[]).includes(s);
}

// Football point values for a single scoring event (TD=6, +1/+2 try, FG=3,
// safety=2, TD+XP=7, TD+2pt=8). Used to validate `addLiveScore` deltas.
const VALID_POINTS = new Set([1, 2, 3, 6, 7, 8]);

export function isValidPoints(points: number): boolean {
  return Number.isInteger(points) && VALID_POINTS.has(points);
}

export function isNonNegInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

export interface Score {
  homeScore: number;
  awayScore: number;
}

/** Add a scoring event to one side, returning the new score. Throws on a
 *  non-football point value or an unknown team. */
export function applyScore(
  score: Score,
  team: "home" | "away",
  points: number,
): Score {
  if (!isValidPoints(points)) throw new Error("invalid_points");
  if (team === "home") return { ...score, homeScore: score.homeScore + points };
  if (team === "away") return { ...score, awayScore: score.awayScore + points };
  throw new Error("invalid_team");
}
