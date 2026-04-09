import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ScreenProvider } from "../hooks/useScreen.js";
import { ErrorsScreen } from "../screens/ErrorsScreen.js";
import { errorTracker } from "../lib/error-tracker.js";

function renderErrors() {
  return render(
    <ScreenProvider initialScreen="errors">
      <ErrorsScreen />
    </ScreenProvider>,
  );
}

describe("ErrorsScreen", () => {
  beforeEach(() => errorTracker.clear());

  it("shows empty state when no errors", () => {
    const { lastFrame } = renderErrors();
    expect(lastFrame()).toContain("No errors recorded");
  });

  it("renders error list with status and route", async () => {
    errorTracker.record({
      timestamp: "2026-04-09T12:00:00.000Z",
      status: 503,
      route: "/api/cli/leagues",
      message: "Service Unavailable",
      payload: null,
    });
    const { lastFrame } = renderErrors();
    await new Promise((r) => setTimeout(r, 50));
    const frame = lastFrame()!;
    expect(frame).toContain("503");
    expect(frame).toContain("/api/cli/leagues");
    expect(frame).toContain("Recent Errors (1)");
  });

  it("shows cursor on first error", async () => {
    errorTracker.record({
      timestamp: "2026-04-09T12:00:00.000Z",
      status: 500,
      route: "/api/test",
      message: "Internal",
      payload: null,
    });
    const { lastFrame } = renderErrors();
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain("❯");
  });
});
