/*
 * Pure aggregation for the stat-keeping keystone (WSM-000112). Sums a player's
 * per-game box-score lines into season totals, group-by-group. Type-light by
 * design (operates on parsed JSON) so it stays in the Convex bundle without a
 * cross-package import and is trivially unit-testable.
 *
 * Most fields SUM; "long" fields (longest run/catch/punt/return) take the MAX —
 * a season long is the single longest play, not a sum.
 */

type StatGroup = Record<string, number>;
type StatLine = Record<string, StatGroup>;

const MAX_FIELDS = new Set(["long"]);

export function aggregateStatLines(lines: StatLine[]): StatLine {
  const out: StatLine = {};
  for (const line of lines) {
    if (!line || typeof line !== "object") continue;
    for (const [group, fields] of Object.entries(line)) {
      if (!fields || typeof fields !== "object") continue;
      const acc = (out[group] = out[group] ?? {});
      for (const [field, value] of Object.entries(fields)) {
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        acc[field] = MAX_FIELDS.has(field)
          ? Math.max(acc[field] ?? 0, value)
          : (acc[field] ?? 0) + value;
      }
    }
  }
  return out;
}

/** Parse a statsJson string into a StatLine, tolerating bad/empty input. */
export function parseStatLine(json: string): StatLine {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as StatLine) : {};
  } catch {
    return {};
  }
}

/**
 * Sum two stat lines. Convenience wrapper over `aggregateStatLines` for the
 * two-operand case; identical semantics, including MAX on "long" fields.
 */
export function addStatLines(a: StatLine, b: StatLine): StatLine {
  return aggregateStatLines([a, b]);
}

/**
 * Why there is no `subtractStatLines` (F3).
 *
 * A persisted season aggregate has to survive a game line being OVERWRITTEN or
 * DELETED — re-entering a box score, or a re-sim under a new engine version.
 * The obvious way to do that is to subtract the old contribution and add the
 * new one. That is unsound here.
 *
 * `MAX_FIELDS` ("long" — longest run, catch, punt, return) takes the MAX across
 * a player's games, not the sum, and a max cannot be inverted. If a player's
 * longs are 40, 55 and 30, the season long is 55; remove the 55-yard game and
 * the correct answer is 40, but nothing in the stored aggregate remembers it.
 * Subtracting would leave 55 forever, silently inflating a record that Epic D's
 * record book will later treat as history.
 *
 * So the aggregate is maintained by REBUILDING the affected player from their
 * own game rows. `playerGameStats` is indexed `by_playerId_seasonId`, so that
 * is a single indexed read of ~10–16 rows — cheaper than the season-wide scan
 * it replaces, and exactly equal to a full rebuild by construction.
 *
 * This is the same conclusion F2 reached for `streak`/`lastResults`, for the
 * analogous reason: an aggregate containing a non-invertible reduction cannot
 * be maintained by deltas.
 */
export function summarizeStatLines(lines: StatLine[]): {
  totals: StatLine;
  gamesPlayed: number;
} {
  return { totals: aggregateStatLines(lines), gamesPlayed: lines.length };
}
