/*
 * Offseason phase machine (B1) — Next-layer entry point.
 *
 * The definition lives in `convex/lib/offseasonPhases.ts` because the Convex
 * bundler can only reach files under `convex/`, while `src/` can reach both.
 * Same arrangement as `src/lib/dynasty-config.ts` and `src/lib/rivalries.ts`,
 * and for the same reason: this is a re-export, NOT a copy.
 *
 * The stake here is `phaseGate`. It is the single decision function for an
 * advance, and it runs on both sides — the server action uses it to decide
 * whether to show the button, the mutation uses it to decide whether to commit.
 * Two implementations that drifted would produce a button that is enabled and
 * an advance that always fails.
 *
 * Import from here in Next code; import from `convex/lib/offseasonPhases`
 * inside Convex functions.
 */
export {
  INITIAL_OFFSEASON_PHASE,
  OFFSEASON_PHASES,
  OFFSEASON_PHASE_LABELS,
  buildPhaseSteps,
  completePhase,
  hasReachedPhase,
  isOffseasonPhase,
  nextPhase,
  phaseGate,
  phaseIndex,
  resolveOffseasonState,
} from "../../../convex/lib/offseasonPhases";

export type {
  AdvanceDecision,
  AdvanceRejection,
  DraftPhaseStatus,
  OffseasonPhase,
  OffseasonState,
  PhaseGateInput,
  PhaseStep,
  PhaseStepState,
} from "../../../convex/lib/offseasonPhases";
