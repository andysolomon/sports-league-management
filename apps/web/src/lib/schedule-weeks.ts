/*
 * WSM-000239 — pure week-grouping helpers for the league schedule page.
 *
 * The schedule page renders fixtures as a lifecycle-aware accordion timeline:
 * completed weeks collapse out of the way, current/mixed weeks stay open.
 * Grouping + classification live here (node-testable, no React) so the server
 * page and the client accordion derive the SAME initial open state — the
 * client seeds its controlled accordion from `initialOpenWeekKeys`, keeping
 * hydration deterministic.
 */

export type WeekKey = string;

/**
 * Lifecycle classification of one week bucket:
 * - `completed` — every fixture is final or cancelled (and the bucket is
 *   non-empty; empty buckets never exist since grouping only creates a bucket
 *   per seen fixture).
 * - `upcoming`  — no fixture is final or cancelled yet. Live/in-progress
 *   fixtures are NOT done, so a week of live games stays open.
 * - `mixed`     — some fixtures done, some not.
 *
 * The "Unscheduled" (null-week) bucket follows the same rules; its only
 * special treatment is sorting last.
 */
export type WeekStatus = "completed" | "upcoming" | "mixed";

export interface FixtureLite {
  week: number | null;
  status: string;
}

export interface WeekGroup<T> {
  /** Stable accordion value: "week-<n>" or "unscheduled". */
  key: WeekKey;
  week: number | null;
  /** Display label: "Week <n>" or "Unscheduled". */
  label: string;
  status: WeekStatus;
  /** Every row in the bucket, in input order. */
  rows: T[];
  /** Rows whose fixture is final or cancelled (the nested subsection for mixed weeks). */
  completedRows: T[];
  /** Rows still to be played (scheduled, live, anything not final/cancelled). */
  remainingRows: T[];
}

export function weekKey(week: number | null): WeekKey {
  return week === null ? "unscheduled" : `week-${week}`;
}

export function weekLabel(week: number | null): string {
  return week === null ? "Unscheduled" : `Week ${week}`;
}

/** A fixture no longer awaiting play: final or cancelled. Live is NOT done. */
export function isFixtureDone(status: string): boolean {
  return status === "final" || status === "cancelled";
}

/**
 * Bucket rows by fixture week (numeric weeks ascending, null week — the
 * "Unscheduled" bucket — last) and classify each bucket's lifecycle status.
 * Generic over the row type so the page can group its hydrated
 * `{ fixture, result, ... }` rows without this module knowing their shape.
 */
export function groupFixturesByWeek<T>(
  rows: T[],
  getFixture: (row: T) => FixtureLite,
): WeekGroup<T>[] {
  const buckets = new Map<number | null, T[]>();
  for (const row of rows) {
    const week = getFixture(row).week;
    const bucket = buckets.get(week) ?? [];
    bucket.push(row);
    buckets.set(week, bucket);
  }

  const weeks = Array.from(buckets.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  return weeks.map((week) => {
    const bucket = buckets.get(week)!;
    const completedRows = bucket.filter((row) =>
      isFixtureDone(getFixture(row).status),
    );
    const remainingRows = bucket.filter(
      (row) => !isFixtureDone(getFixture(row).status),
    );
    const status: WeekStatus =
      remainingRows.length === 0
        ? "completed"
        : completedRows.length === 0
          ? "upcoming"
          : "mixed";
    return {
      key: weekKey(week),
      week,
      label: weekLabel(week),
      status,
      rows: bucket,
      completedRows,
      remainingRows,
    };
  });
}

/**
 * Initial accordion open state: completed weeks closed, upcoming and mixed
 * weeks open. Server page and client component both call this so the first
 * client render matches the server HTML exactly.
 */
export function initialOpenWeekKeys(
  groups: Array<{ key: WeekKey; status: WeekStatus }>,
): WeekKey[] {
  return groups
    .filter((group) => group.status !== "completed")
    .map((group) => group.key);
}
