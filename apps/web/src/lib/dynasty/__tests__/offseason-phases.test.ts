import { describe, it, expect } from "vitest";
import {
  INITIAL_OFFSEASON_PHASE,
  OFFSEASON_PHASES,
  buildPhaseSteps,
  completePhase,
  hasReachedPhase,
  isOffseasonPhase,
  nextPhase,
  phaseGate,
  resolveOffseasonState,
  type OffseasonPhase,
} from "@/lib/dynasty/offseason-phases";

const gate = (
  from: string,
  to: string,
  draftStatus: "none" | "active" | "complete" = "none",
) => phaseGate({ from, to, draftStatus });

describe("phase ordering", () => {
  it("walks the machine forward and stops at the end", () => {
    let phase: OffseasonPhase = OFFSEASON_PHASES[0];
    const walked: OffseasonPhase[] = [phase];
    for (;;) {
      const next = nextPhase(phase);
      if (!next) break;
      phase = next;
      walked.push(phase);
    }
    expect(walked).toEqual([...OFFSEASON_PHASES]);
    expect(nextPhase("activate")).toBeNull();
  });

  it("compares phases by position, not by name", () => {
    expect(hasReachedPhase("free_agency", "draft")).toBe(true);
    expect(hasReachedPhase("draft", "draft")).toBe(true);
    expect(hasReachedPhase("draft", "free_agency")).toBe(false);
  });

  it("returns false rather than a wrong answer for an unknown phase", () => {
    // -1 indexes would otherwise compare as "reached", which is the classic
    // way a phase machine silently lets an unknown value through.
    expect(hasReachedPhase("nonsense", "draft")).toBe(false);
    expect(hasReachedPhase("draft", "nonsense")).toBe(false);
    expect(isOffseasonPhase("nonsense")).toBe(false);
  });

  it("opens at recruiting, because the rollover has already happened", () => {
    expect(INITIAL_OFFSEASON_PHASE).toBe("recruiting");
    expect(resolveOffseasonState(null).completedPhases).toContain("rollover");
  });

  it("puts recruiting between the rollover and the draft (B3)", () => {
    /*
     * Order is the contract, not the membership. Recruiting has to run before
     * the draft because a prospect a team signs is a roster spot the draft can
     * no longer fill — the other order would let a coach draft into a class he
     * has not chosen yet.
     */
    expect(nextPhase("rollover")).toBe("recruiting");
    expect(nextPhase("recruiting")).toBe("draft");
  });
});

describe("phaseGate", () => {
  it("allows a forward advance to the immediate next phase", () => {
    expect(gate("draft", "free_agency")).toEqual({ ok: true, kind: "advance" });
  });

  it("treats a repeat advance as a landed retry, not a failure", () => {
    // A double-clicked Advance must not surface an error to an admin who did
    // nothing wrong.
    expect(gate("free_agency", "free_agency")).toEqual({
      ok: true,
      kind: "noop",
    });
  });

  it("rejects a backward advance as a regression", () => {
    expect(gate("free_agency", "draft")).toEqual({
      ok: false,
      reason: "phase_regression",
    });
  });

  it("rejects skipping a phase", () => {
    expect(gate("draft", "activate")).toEqual({
      ok: false,
      reason: "phase_out_of_order",
    });
  });

  it("gates leaving the draft while it is mid-pick", () => {
    expect(gate("draft", "free_agency", "active")).toEqual({
      ok: false,
      reason: "draft_in_progress",
    });
  });

  it("lets an unstarted or finished draft be left", () => {
    // "none" is a league declining to run one — not a reason to be stuck.
    expect(gate("draft", "free_agency", "none").ok).toBe(true);
    expect(gate("draft", "free_agency", "complete").ok).toBe(true);
  });

  it("rejects a phase name it does not know", () => {
    expect(gate("draft", "bowl_season")).toEqual({
      ok: false,
      reason: "unknown_phase",
    });
  });
});

describe("completePhase", () => {
  it("behaves as a set — advancing twice records one entry", () => {
    const once = completePhase(["rollover"], "draft");
    const twice = completePhase(once, "draft");
    expect(once).toEqual(["rollover", "draft"]);
    expect(twice).toEqual(once);
  });

  it("keeps machine order regardless of insertion order", () => {
    expect(completePhase(["free_agency", "rollover"], "draft")).toEqual([
      "rollover",
      "draft",
      "free_agency",
    ]);
  });

  it("drops names that are not phases instead of persisting them", () => {
    expect(completePhase(["rollover", "bowl_season"], "draft")).toEqual([
      "rollover",
      "draft",
    ]);
  });
});

describe("buildPhaseSteps", () => {
  it("derives step state from the completed set, not from position", () => {
    const steps = buildPhaseSteps({
      phase: "activate",
      completedPhases: ["rollover", "free_agency"],
    });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s.state]));
    // `draft` is behind the current phase but was never completed.
    expect(byId.draft).toBe("optional");
    expect(byId.free_agency).toBe("complete");
    expect(byId.activate).toBe("active");
  });

  it("shows a skipped recruiting phase as optional, not as missing (B3)", () => {
    /*
     * A league that signed nobody must be able to leave the phase, and the
     * stepper has to say so. Rendering it as `upcoming` behind the current
     * phase would read as "you still have to do this" for something already
     * passed.
     */
    const steps = buildPhaseSteps({
      phase: "draft",
      completedPhases: ["rollover"],
    });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s.state]));
    expect(byId.recruiting).toBe("optional");
  });

  it("labels every phase in the machine exactly once", () => {
    const steps = buildPhaseSteps({ phase: "draft", completedPhases: [] });
    expect(steps.map((s) => s.id)).toEqual([...OFFSEASON_PHASES]);
    expect(steps.filter((s) => s.state === "active")).toHaveLength(1);
  });
});

describe("resolveOffseasonState", () => {
  it("uses the stored row whenever there is one", () => {
    expect(
      resolveOffseasonState({ phase: "activate", completedPhases: ["draft"] }),
    ).toEqual({ phase: "activate", completedPhases: ["draft"] });
  });

  it("falls back to draft status only when the row is absent", () => {
    expect(resolveOffseasonState(null, { draftStatus: "complete" })).toEqual({
      phase: "free_agency",
      completedPhases: ["rollover", "draft"],
    });
  });

  it("ignores a stored phase it cannot interpret", () => {
    // A row written by a future version must not put the stepper into a state
    // with no active phase.
    const state = resolveOffseasonState(
      { phase: "bowl_season", completedPhases: ["rollover"] },
      { draftStatus: "none" },
    );
    expect(state.phase).toBe(INITIAL_OFFSEASON_PHASE);
  });

  it("filters unknown names out of the completed set", () => {
    const state = resolveOffseasonState({
      phase: "free_agency",
      completedPhases: ["rollover", "bowl_season"],
    });
    expect(state.completedPhases).toEqual(["rollover"]);
  });
});
