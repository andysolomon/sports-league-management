/*
 * Shared deterministic RNG — Next-layer entry point (Dynasty Mode F1, moved B3).
 *
 * The implementation lives in `convex/lib/rng.ts` because the Convex bundler can
 * only reach files under `convex/`, while `src/` can reach both. Scouting (B3)
 * is the first system that needs the same stream on both sides of the boundary:
 * `applyScoutingNoise` runs in the mutation that persists a scout AND in the
 * component that renders one, and those two must agree exactly.
 *
 * This is a re-export, NOT a copy. Same arrangement as `src/lib/dynasty-config.ts`
 * and `src/lib/dynasty/offseason-phases.ts`, and for the same reason.
 *
 * Import from here in Next code; import from `convex/lib/rng` inside Convex
 * functions. The seed-namespace convention every caller must follow is
 * documented on the implementation.
 */
export {
  mulberry32,
  rngFor,
  seedFor,
  seedFromString,
} from "../../convex/lib/rng";

export type { SeedDomain } from "../../convex/lib/rng";
