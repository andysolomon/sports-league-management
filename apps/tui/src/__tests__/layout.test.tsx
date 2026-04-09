import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Header, Footer, StatusLine, Layout } from "../components/Layout.js";

describe("Header", () => {
  it("renders app name", () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).toContain("sprtsmng tui");
  });

  it("shows email when provided", () => {
    const { lastFrame } = render(<Header email="test@example.com" />);
    expect(lastFrame()).toContain("test@example.com");
  });

  it("shows 'not authenticated' when no email", () => {
    const { lastFrame } = render(<Header />);
    expect(lastFrame()).toContain("not authenticated");
  });
});

describe("Footer", () => {
  it("renders default hints", () => {
    const { lastFrame } = render(<Footer />);
    expect(lastFrame()).toContain("navigate");
    expect(lastFrame()).toContain("q quit");
  });

  it("renders custom hints", () => {
    const { lastFrame } = render(<Footer hints="tab switch · q quit" />);
    expect(lastFrame()).toContain("tab switch");
  });
});

describe("StatusLine", () => {
  it("renders nothing when no message", () => {
    const { lastFrame } = render(<StatusLine />);
    expect(lastFrame()).toBe("");
  });

  it("renders message when provided", () => {
    const { lastFrame } = render(<StatusLine message="Loading..." />);
    expect(lastFrame()).toContain("Loading...");
  });
});

describe("Layout", () => {
  it("composes header, children, and footer", () => {
    const { lastFrame } = render(
      <Layout email="dev@test.com">
        <></>
      </Layout>,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("sprtsmng tui");
    expect(frame).toContain("dev@test.com");
    expect(frame).toContain("q quit");
  });

  it("shows status line when status prop is set", () => {
    const { lastFrame } = render(
      <Layout status="Fetching leagues...">
        <></>
      </Layout>,
    );
    expect(lastFrame()).toContain("Fetching leagues...");
  });
});
