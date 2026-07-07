import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OffseasonPhaseStepper } from "@/components/offseason/OffseasonPhaseStepper";

describe("OffseasonPhaseStepper", () => {
  it("renders free agency active when no draft exists", () => {
    const html = renderToStaticMarkup(
      createElement(OffseasonPhaseStepper, { draftStatus: "none" }),
    );
    expect(html).toContain('data-testid="offseason-phase-stepper"');
    expect(html).toContain("Free agency");
    expect(html).toContain("Draft");
    expect(html).toContain("Optional");
  });

  it("marks draft active when a draft is in progress", () => {
    const html = renderToStaticMarkup(
      createElement(OffseasonPhaseStepper, { draftStatus: "active" }),
    );
    expect(html).toContain("border-primary bg-primary/10");
    expect(html).not.toContain("Optional");
  });

  it("marks draft complete when the draft has finished", () => {
    const html = renderToStaticMarkup(
      createElement(OffseasonPhaseStepper, { draftStatus: "complete" }),
    );
    expect(html).toContain("border-primary/30 bg-primary/5");
  });
});
