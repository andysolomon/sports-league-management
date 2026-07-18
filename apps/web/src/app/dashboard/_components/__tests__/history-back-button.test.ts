import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoryBackButton } from "../history-back-button";

describe("HistoryBackButton", () => {
  it("renders a labelled, test-id'd button", () => {
    const html = renderToStaticMarkup(
      createElement(HistoryBackButton, { label: "Back" }),
    );
    expect(html).toContain('data-testid="history-back-button"');
    expect(html).toContain('aria-label="Back"');
    expect(html).toContain("Back");
  });

  it("renders disabled when no client-side history is present (SSR pass)", () => {
    // The component reads `window.history.length` in an effect; on the server
    // (or before the effect fires), `hasHistory` defaults to false, which the
    // button reflects with `disabled` so it cannot navigate away unexpectedly.
    const html = renderToStaticMarkup(
      createElement(HistoryBackButton, { label: "Back" }),
    );
    expect(html).toContain("disabled");
  });
});