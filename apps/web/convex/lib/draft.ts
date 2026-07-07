/**
 * Snake-draft helpers (WSM-000233). Pure functions for unit testing.
 */

/** 1-based round number for a global pick slot. */
export function pickRound(pickNumber: number, teamCount: number): number {
  if (teamCount <= 0) return 0;
  return Math.ceil(pickNumber / teamCount);
}

/**
 * Team on the clock for a 1-based pickNumber in a snake draft.
 * Round 1 = forward order, round 2 = reverse, etc.
 */
export function teamOnClock(
  order: readonly string[],
  pickNumber: number,
  rounds: number,
): string | null {
  const teamCount = order.length;
  if (teamCount === 0 || pickNumber < 1) return null;
  const totalPicks = rounds * teamCount;
  if (pickNumber > totalPicks) return null;

  const round = pickRound(pickNumber, teamCount);
  const posInRound = (pickNumber - 1) % teamCount;
  const index =
    round % 2 === 1 ? posInRound : teamCount - 1 - posInRound;
  return order[index] ?? null;
}
