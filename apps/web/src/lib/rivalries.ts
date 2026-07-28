/*
 * Rivalry pairing rules (A5) — Next-layer entry point.
 *
 * The definition lives in `convex/lib/rivalries.ts` because the Convex bundler
 * can only reach files under `convex/`, while `src/` can reach both. Same
 * arrangement as `src/lib/dynasty-config.ts`, and for the same reason: this is
 * a re-export, NOT a copy.
 *
 * The stake here is the pair key. Convex deduplicates rivalries on it and the
 * engine looks rivalries up with it — two implementations that drifted would
 * make a declared rivalry silently stop being found at simulation time.
 *
 * Import from here in Next code; import from `convex/lib/rivalries` inside
 * Convex functions.
 */
export {
  RIVALRY_INTENSITY_DEFAULT,
  RIVALRY_INTENSITY_MAX,
  RIVALRY_INTENSITY_MIN,
  normalizeIntensity,
  rivalryPairKey,
  sortRivalryTeams,
} from "../../convex/lib/rivalries";
