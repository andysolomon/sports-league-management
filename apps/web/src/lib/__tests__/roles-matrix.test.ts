import { describe, it, expect } from "vitest";
import { capabilityGrid, ROLE_SUMMARIES } from "../roles-matrix";
import { ORG_ROLES } from "../permissions";

describe("capabilityGrid", () => {
  const grid = capabilityGrid();
  const row = (label: string) => grid.find((r) => r.label === label)!;

  it("covers every capability for all three roles", () => {
    expect(grid.length).toBeGreaterThanOrEqual(10);
    for (const r of grid) {
      expect(Object.keys(r.allowed).sort()).toEqual([...ORG_ROLES].sort());
    }
  });

  it("viewer can only view", () => {
    expect(row("View everything").allowed.viewer).toBe(true);
    // Every non-view capability is denied to viewer.
    const nonView = grid.filter((r) => r.label !== "View everything");
    expect(nonView.every((r) => r.allowed.viewer === false)).toBe(true);
  });

  it("coach manages the roster but not org settings", () => {
    expect(row("Manage players").allowed.coach).toBe(true);
    expect(row("Manage schedules & results").allowed.coach).toBe(true);
    // Org-settings capabilities are admin-only.
    expect(row("Manage members & invites").allowed.coach).toBe(false);
    expect(row("Delete teams").allowed.coach).toBe(false);
    expect(row("Change league visibility").allowed.coach).toBe(false);
  });

  it("admin can do everything", () => {
    expect(grid.every((r) => r.allowed.admin === true)).toBe(true);
  });

  it("documents a summary for each role", () => {
    expect(ROLE_SUMMARIES.map((s) => s.role).sort()).toEqual(
      [...ORG_ROLES].sort(),
    );
  });
});
