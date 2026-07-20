import { describe, expect, it } from "vitest";
import { leagueActivationHref } from "@/components/workspace/resource-navigation";
import { buildPaletteNavItems, buildShellNavItems } from "../shell-nav";

describe("shell + command palette nav contracts (issue #577)", () => {
  it("builds identical league-scoped shell destinations for sidebar parity", () => {
    const items = buildShellNavItems("league-1");
    expect(items.map((i) => i.label)).toEqual([
      "Overview",
      "Teams",
      "Players",
      "Seasons",
      "Import",
      "Billing",
    ]);
    expect(items.find((i) => i.id === "overview")?.href).toBe(
      "/dashboard/leagues/league-1",
    );
    expect(items.some((i) => i.href === "/dashboard/divisions")).toBe(false);
    expect(items.some((i) => i.href === "/dashboard/discover")).toBe(false);
  });

  it("palette Navigate group keeps League Directory and drops obsolete commands", () => {
    const items = buildPaletteNavItems("league-1");
    const labels = items.map((i) => i.label);

    expect(labels).toContain("League Directory");
    expect(labels).toContain("Overview");
    expect(labels).toContain("Import");
    expect(labels).toContain("Billing");

    expect(labels).not.toContain("Divisions");
    expect(labels).not.toContain("Discover");
    expect(labels).not.toContain("Roles & permissions");
    expect(labels).not.toContain("Leagues");

    expect(items.find((i) => i.id === "league-directory")?.href).toBe(
      "/dashboard/leagues",
    );
    expect(items.find((i) => i.id === "overview")?.href).toBe(
      "/dashboard/leagues/league-1",
    );
  });

  it("palette Overview falls back to League Directory without an Active League", () => {
    const items = buildPaletteNavItems(null);
    expect(items.find((i) => i.id === "overview")?.href).toBe(
      "/dashboard/leagues",
    );
  });

  it("League palette picks activate via the Active League handler (ASR-1/23)", () => {
    const href = leagueActivationHref("league-2");
    expect(href).toContain("/dashboard/active-league?");
    expect(href).toContain("leagueId=league-2");
    expect(href).toContain(
      encodeURIComponent("/dashboard/leagues/league-2"),
    );
  });
});
