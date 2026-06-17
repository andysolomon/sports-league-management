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
