/*
 * Dynasty Mode per-league settings (F5) — Next-layer entry point.
 *
 * The definition lives in `convex/lib/dynastyConfig.ts` because the Convex
 * bundler can only reach files under `convex/`, while `src/` can reach both.
 * This is a re-export, NOT a copy: mirroring the defaults in two places would
 * let the simulation and the settings UI disagree about what "normal" means,
 * and nothing would catch it until a league behaved oddly.
 *
 * Import from here in Next code so the direction of the dependency stays
 * obvious; import from `convex/lib/dynastyConfig` inside Convex functions.
 */
export {
  DYNASTY_CONFIG_BOUNDS,
  DYNASTY_CONFIG_DEFAULTS,
  normalizeDynastyConfigPatch,
  resolveDynastyConfig,
  type DynastyConfig,
  type DynastyConfigDoc,
  type TransferVolume,
} from "../../convex/lib/dynastyConfig";
