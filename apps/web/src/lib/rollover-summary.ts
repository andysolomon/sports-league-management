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
  recruiting: { freshmen: number; toPool: boolean };
}
