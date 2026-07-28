/*
 * Recruit scouting (B3) — Next-layer entry point.
 *
 * The definition lives in `convex/lib/scouting.ts` because the Convex bundler
 * can only reach files under `convex/`, while `src/` can reach both. Same
 * arrangement as `src/lib/dynasty/offseason-phases.ts` and for a sharper reason:
 * `applyScoutingNoise` runs in the mutation that persists a scout AND in the
 * panel that renders one. Two implementations that drifted would show a coach a
 * range the server does not believe.
 *
 * This is a re-export, NOT a copy.
 */
export {
  MAX_SCOUT_LEVEL,
  MIN_SCOUT_LEVEL,
  OVERALL_MAX,
  OVERALL_MIN,
  POTENTIAL_TIERS,
  SCOUT_BAND_WIDTH,
  SCOUT_LEVEL_COST,
  applyScoutingNoise,
  clampScoutLevel,
  isPotentialTier,
  nextScoutCost,
  scoutingBand,
  scoutingBands,
} from "../../../convex/lib/scouting";

export type {
  ApplyScoutingNoiseInput,
  PotentialTier,
  ScoutingBand,
  ScoutingReport,
} from "../../../convex/lib/scouting";
