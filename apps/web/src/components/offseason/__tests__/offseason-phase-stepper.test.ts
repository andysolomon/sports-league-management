import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OffseasonPhaseStepper } from "@/components/offseason/OffseasonPhaseStepper";

describe("OffseasonPhaseStepper upcoming-only contract", () => {
  it("renders the offseason phase stepper used on upcoming season pages", () => {
    const html = renderToStaticMarkup(
      createElement(OffseasonPhaseStepper, { activePhase: "free_agency" }),
    );
    expect(html).toContain('data-testid="offseason-phase-stepper"');
    expect(html).toContain("Free agency");
    expect(html).toContain("Rollover");
    expect(html).toContain("Activate");
  });
});
