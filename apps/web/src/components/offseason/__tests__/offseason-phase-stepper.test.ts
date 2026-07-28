import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OffseasonPhaseStepper } from "@/components/offseason/OffseasonPhaseStepper";
import { resolveOffseasonState } from "@/lib/dynasty/offseason-phases";

/*
 * These assertions moved from draft status to persisted state in B1. The
 * stepper no longer infers anything — it renders the row.
 */
describe("OffseasonPhaseStepper", () => {
  it("renders the persisted phase as active and completed phases as complete", () => {
    const html = renderToStaticMarkup(
      createElement(OffseasonPhaseStepper, {
        state: {
          phase: "free_agency",
          completedPhases: ["rollover", "draft"],
        },
      }),
    );
    expect(html).toContain('data-testid="offseason-phase-stepper"');
    expect(html).toContain('data-phase="free_agency"');
    expect(html).toContain('data-testid="offseason-phase-draft" data-state="complete"');
    expect(html).toContain(
      'data-testid="offseason-phase-free_agency" data-state="active"',
    );
    expect(html).toContain(
      'data-testid="offseason-phase-activate" data-state="upcoming"',
    );
  });

  it("marks a passed-over draft as skipped rather than complete", () => {
    // The distinction is real: a league that never ran a draft did not
    // complete that phase, it declined it.
    const html = renderToStaticMarkup(
      createElement(OffseasonPhaseStepper, {
        state: { phase: "free_agency", completedPhases: ["rollover"] },
      }),
    );
    expect(html).toContain(
      'data-testid="offseason-phase-draft" data-state="optional"',
    );
    expect(html).toContain("Skipped");
  });

  it("renders a season with no stored row from the draft-status bridge", () => {
    const html = renderToStaticMarkup(
      createElement(OffseasonPhaseStepper, {
        state: resolveOffseasonState(null, { draftStatus: "active" }),
      }),
    );
    expect(html).toContain('data-phase="draft"');
  });

  it("prefers the stored row over the bridge when both are available", () => {
    // The bridge is a migration path, not a parallel source of truth.
    const state = resolveOffseasonState(
      { phase: "activate", completedPhases: ["rollover", "draft", "free_agency"] },
      { draftStatus: "active" },
    );
    expect(state.phase).toBe("activate");
  });
});
