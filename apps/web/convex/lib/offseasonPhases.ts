/*
 * The offseason phase machine (Dynasty Mode B1).
 *
 * Pure and Convex-free. Every rule about what an offseason may do next lives
 * here; the Convex mutation adds only concurrency. That split is deliberate —
 * the rules are the part worth testing exhaustively, and they are the part
 * later slices (B2–B6) extend.
 *
 * ## Why this table exists at all when `seasonRollovers` already has stages
 *
 * `seasonRollovers` owns the AUTOMATIC stages: six mechanical steps that run
 * back-to-back inside one server action under a 60-second lease. This machine
 * owns the HUMAN-PACED ones: an admin can sit in the draft phase for three
 * days. Modelling both with one lease would make the lease meaningless — a
 * 60-second timeout on a phase measured in days either expires constantly or
 * has to be so long it stops protecting anything.
 *
 * ## Adding a phase later
 *
 * Insert it into `OFFSEASON_PHASES` in position. `completedPhases` is a SET of
 * names rather than a high-water index, so an offseason already in flight when
 * a new phase is inserted behind it simply never has that name in its set. It
 * reads as "skipped", which is exactly what happened, and no migration is
 * forced. `hasReachedPhase` is the only thing that depends on order.
 */

export const OFFSEASON_PHASES = [
  "rollover",
  "recruiting",
  "transfers",
  "draft",
  "free_agency",
  "activate",
] as const;

export type OffseasonPhase = (typeof OFFSEASON_PHASES)[number];

export const OFFSEASON_PHASE_LABELS: Record<OffseasonPhase, string> = {
  rollover: "Rollover",
  recruiting: "Recruiting",
  transfers: "Transfers",
  draft: "Draft",
  free_agency: "Free agency",
  activate: "Activate",
};

/**
 * Phases an admin may pass through without doing anything in them.
 *
 * The draft is genuinely optional — a league that does not run one still has
 * to leave the phase, so "optional" means "advanceable while empty", not
 * "skippable in the ordering".
 *
 * Recruiting joined it in B3 for a stronger reason than convenience: a class
 * left entirely unsigned must not be able to trap an offseason. The cost of
 * skipping it is a roster of walk-ons, which is a consequence, not a block.
 *
 * Transfers joined it in B4 for the same reason, plus one of its own: an
 * unresolved transfer is a decision NOT to decide, and a coach who never opens
 * the window has implicitly kept everybody. Blocking on it would let one
 * absent coach freeze the league.
 */
const OPTIONAL_PHASES: ReadonlySet<OffseasonPhase> = new Set([
  "recruiting",
  "transfers",
  "draft",
]);

/*
 * A new offseason opens at `draft`, not at `rollover`.
 *
 * `rollover` is in the machine as a completed marker only. By the time an
 * offseason row can exist the mechanical rollover has already run — it is what
 * created the target season — and it is owned by `seasonRollovers`, not by
 * this machine. Opening at `rollover` would show an admin a phase they cannot
 * act on and have already finished.
 *
 * B3 moved the opening phase from `draft` to `recruiting` by inserting one in
 * front of it. That is the migration-free insert this file's header describes:
 * an offseason already sitting in `draft` when B3 deployed keeps its phase, and
 * simply never has `recruiting` in its `completedPhases` set. The stepper reads
 * that as skipped, which is exactly what happened to it.
 */
export const INITIAL_OFFSEASON_PHASE: OffseasonPhase = "recruiting";

export type DraftPhaseStatus = "none" | "active" | "complete";

export interface OffseasonState {
  phase: OffseasonPhase;
  completedPhases: OffseasonPhase[];
}

export function isOffseasonPhase(value: string): value is OffseasonPhase {
  return (OFFSEASON_PHASES as readonly string[]).includes(value);
}

export function phaseIndex(phase: string): number {
  return (OFFSEASON_PHASES as readonly string[]).indexOf(phase);
}

/** The phase after `phase`, or `null` at the end of the machine. */
export function nextPhase(phase: OffseasonPhase): OffseasonPhase | null {
  const index = phaseIndex(phase);
  if (index < 0 || index >= OFFSEASON_PHASES.length - 1) return null;
  return OFFSEASON_PHASES[index + 1];
}

/**
 * True when `phase` is at or past `expected`.
 *
 * Mirrors `hasReachedRolloverStage` in `_actions/dynasty.ts` on purpose: two
 * different comparison idioms for two different phase machines in the same
 * feature would be a reliable source of off-by-one bugs.
 */
export function hasReachedPhase(phase: string, expected: string): boolean {
  const current = phaseIndex(phase);
  const target = phaseIndex(expected);
  if (current < 0 || target < 0) return false;
  return current >= target;
}

export type AdvanceRejection =
  | "phase_regression"
  | "phase_out_of_order"
  | "unknown_phase"
  | "draft_in_progress";

export type AdvanceDecision =
  | { ok: true; kind: "advance" }
  /** Already at `to` — a retry of a request that landed. */
  | { ok: true; kind: "noop" }
  | { ok: false; reason: AdvanceRejection };

export interface PhaseGateInput {
  from: string;
  to: string;
  draftStatus: DraftPhaseStatus;
}

/**
 * Whether an offseason at `from` may move to `to`.
 *
 * The single decision function for an advance. It returns a `noop` rather than
 * an error when the offseason is already at `to`, which is what makes a
 * double-submitted advance safe: the second one is not a failure, it is a
 * request that was already satisfied.
 */
export function phaseGate(input: PhaseGateInput): AdvanceDecision {
  if (!isOffseasonPhase(input.from) || !isOffseasonPhase(input.to)) {
    return { ok: false, reason: "unknown_phase" };
  }
  if (input.to === input.from) return { ok: true, kind: "noop" };
  if (hasReachedPhase(input.from, input.to)) {
    return { ok: false, reason: "phase_regression" };
  }
  if (input.to !== nextPhase(input.from)) {
    return { ok: false, reason: "phase_out_of_order" };
  }

  /*
   * The one real gameplay gate today. A draft that is mid-pick holds roster
   * moves that free agency would otherwise contradict, so the phase cannot be
   * left until it is finished. `none` is fine — an unstarted draft is the
   * league declining to run one.
   */
  if (input.from === "draft" && input.draftStatus === "active") {
    return { ok: false, reason: "draft_in_progress" };
  }

  return { ok: true, kind: "advance" };
}

/**
 * Add `phase` to `completed` without duplicating it, in machine order.
 *
 * Takes a plain string and filters against the machine, so a name that is not
 * a phase — a stored value from a future version, a typo — is dropped rather
 * than persisted. That also makes the result self-repairing: a row that
 * somehow accumulated junk is cleaned the next time it advances.
 */
export function completePhase(
  completed: readonly string[],
  phase: string,
): OffseasonPhase[] {
  const set = new Set<string>([...completed, phase]);
  return OFFSEASON_PHASES.filter((candidate) => set.has(candidate));
}

export type PhaseStepState = "complete" | "active" | "upcoming" | "optional";

export interface PhaseStep {
  id: OffseasonPhase;
  label: string;
  state: PhaseStepState;
}

/**
 * The stepper's view of an offseason.
 *
 * Reads only persisted state. A phase is `complete` because it is IN
 * `completedPhases`, not because the current phase happens to be past it —
 * those differ for an offseason that was migrated or had a phase inserted
 * behind it, and the set is the honest answer.
 */
export function buildPhaseSteps(state: OffseasonState): PhaseStep[] {
  const completed = new Set<string>(state.completedPhases);
  return OFFSEASON_PHASES.map((phase) => {
    const state_: PhaseStepState =
      phase === state.phase
        ? "active"
        : completed.has(phase)
          ? "complete"
          : OPTIONAL_PHASES.has(phase) && hasReachedPhase(state.phase, phase)
            ? "optional"
            : "upcoming";
    return { id: phase, label: OFFSEASON_PHASE_LABELS[phase], state: state_ };
  });
}

/**
 * A usable state for a season with no stored row.
 *
 * Two callers need this and they need different things from it:
 *
 * - A season that just rolled over has genuinely completed `rollover` and
 *   nothing else. That is the default.
 * - A league that entered its offseason BEFORE this table existed has real
 *   draft progress that no row records. Inferring the phase from draft status
 *   is a one-way bridge for those leagues, not a parallel source of truth: it
 *   is consulted only when the row is absent, and the row wins the moment one
 *   exists. It can be deleted once every live league has been through an
 *   offseason under B1.
 */
export function resolveOffseasonState(
  row: { phase: string; completedPhases: string[] } | null | undefined,
  bridge: { draftStatus: DraftPhaseStatus } = { draftStatus: "none" },
): OffseasonState {
  if (row && isOffseasonPhase(row.phase)) {
    return {
      phase: row.phase,
      completedPhases: row.completedPhases.filter(isOffseasonPhase),
    };
  }
  if (bridge.draftStatus === "active") {
    return { phase: "draft", completedPhases: ["rollover"] };
  }
  if (bridge.draftStatus === "complete") {
    return { phase: "free_agency", completedPhases: ["rollover", "draft"] };
  }
  return { phase: INITIAL_OFFSEASON_PHASE, completedPhases: ["rollover"] };
}
