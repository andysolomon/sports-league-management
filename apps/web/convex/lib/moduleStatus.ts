import { v } from "convex/values";

/**
 * Shared shape for the Dynasty Mode module readiness probes (F1).
 *
 * Each new Convex module (`dynasty`, `sim`, `program`, `history`) exports one
 * `moduleStatus` query using this validator. The probe returns a compile-time
 * constant and reads no data — it exists so each module registers with a
 * non-empty public surface, which is what makes `api.<module>` a real object
 * for the guard test's `Exclude` backstop and the typed refs in
 * `src/lib/data-api.ts` to key off.
 */
export const moduleStatusValidator = v.object({
  /** Convex module name, matching the file name. */
  module: v.string(),
  /** Roadmap epic this module serves. */
  epic: v.string(),
  /** True once the module is registered and callable. */
  ready: v.boolean(),
});

/** Module names, kept in one place so the probes and refs cannot drift. */
export const DYNASTY_MODULES = {
  dynasty: "dynasty",
  sim: "sim",
  program: "program",
  history: "history",
} as const;

export type DynastyModuleName =
  (typeof DYNASTY_MODULES)[keyof typeof DYNASTY_MODULES];
