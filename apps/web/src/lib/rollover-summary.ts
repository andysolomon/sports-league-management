/**
 * Persisted, truthful summary of a dynasty season rollover (WSM-000243).
 *
 * The rollover action threads this structure through every stage checkpoint so
 * the panel and process dialog render persisted counts rather than transient
 * client-side tallies. Every field maps to a real, completed side effect — no
 * simulated progress or timed percentages.
 */
export interface RolloverOperationSummary {
  sourceSeason: { id: string; name: string };
  targetSeason: { id: string; name: string };
  graduation: { players: number };
  advancement: { players: number };
  progression: { snapshots: number };
  carryover: {
    copiedAssignments: number;
    copiedDepthEntries: number;
    removedAssignments: number;
    removedDepthEntries: number;
  };
  recruiting: {
    /** Walk-ons the backfill added to top rosters up to the target size. */
    freshmen: number;
    toPool: boolean;
    /**
     * Prospects on the recruiting board (B3) — a separate count from
     * `freshmen` because they are separate populations. The backfill guarantees
     * a playable roster; the class is the talent a coach competes for on top of
     * it. Adding them together would hide a league that recruited nothing.
     */
    prospects: number;
  };
  /**
   * Injuries closed out by the `injuries_healed` stage (B2). Zero is a real
   * answer — a season nobody got hurt in — and is why this is not optional.
   */
  healing: { injuries: number };
}
