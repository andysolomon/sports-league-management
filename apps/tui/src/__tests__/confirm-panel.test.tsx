import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ConfirmPanel } from "../components/ConfirmPanel.js";

describe("ConfirmPanel", () => {
  it("renders the action label and item count", () => {
    const { lastFrame } = render(
      <ConfirmPanel
        actionLabel="Delete leagues"
        items={["Premier League", "La Liga"]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("Delete leagues");
    expect(frame).toContain("2 items");
  });

  it("renders individual items", () => {
    const { lastFrame } = render(
      <ConfirmPanel
        actionLabel="Export"
        items={["Item A", "Item B"]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("Item A");
    expect(lastFrame()).toContain("Item B");
  });

  it("shows overflow count when more than 10 items", () => {
    const items = Array.from({ length: 15 }, (_, i) => `Item ${i + 1}`);
    const { lastFrame } = render(
      <ConfirmPanel
        actionLabel="Bulk action"
        items={items}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("5 more");
  });

  it("shows confirm/cancel key hints", () => {
    const { lastFrame } = render(
      <ConfirmPanel
        actionLabel="Test"
        items={["A"]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("confirm");
    expect(lastFrame()).toContain("cancel");
  });
});
