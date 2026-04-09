import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../App.js";

describe("App", () => {
  it("renders the header with app name", () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain("sprtsmng tui");
  });

  it("renders the version text", () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain("v0.4.0");
  });

  it("renders the footer with keyboard hints", () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain("navigate");
    expect(lastFrame()).toContain("q quit");
  });

  it("shows 'not authenticated' when no credentials exist", () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain("not authenticated");
  });
});
