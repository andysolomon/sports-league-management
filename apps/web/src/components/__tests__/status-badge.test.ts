import { describe, it, expect } from "vitest";
import { resolveStatusBadge } from "../status-badge";

describe("resolveStatusBadge", () => {
  it("maps a canonical status to its variant + label", () => {
    expect(resolveStatusBadge("Active")).toEqual({
      variant: "success",
      label: "Active",
    });
    expect(resolveStatusBadge("Injured")).toEqual({
      variant: "warning",
      label: "Injured",
    });
  });

  it("normalizes non-canonical casing to the canonical variant + label", () => {
    // Synthetic rosters historically wrote lowercase "active"; it should still
    // resolve to the green Active badge.
    expect(resolveStatusBadge("active")).toEqual({
      variant: "success",
      label: "Active",
    });
    expect(resolveStatusBadge("INACTIVE")).toEqual({
      variant: "secondary",
      label: "Inactive",
    });
  });

  it("passes an unknown status through with a neutral variant", () => {
    expect(resolveStatusBadge("Suspended")).toEqual({
      variant: "secondary",
      label: "Suspended",
    });
  });
});
