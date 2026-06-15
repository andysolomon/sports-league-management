import { describe, it, expect } from "vitest";
import { breadcrumbsForPath } from "../breadcrumbs";

describe("breadcrumbsForPath", () => {
  it("returns a single crumb at the dashboard root", () => {
    expect(breadcrumbsForPath("/dashboard")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
    ]);
  });

  it("labels known sections", () => {
    expect(breadcrumbsForPath("/dashboard/teams")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Teams", href: "/dashboard/teams" },
    ]);
  });

  it("skips dynamic id segments but keeps them in later hrefs", () => {
    const crumbs = breadcrumbsForPath("/dashboard/leagues/abc123XYZ/members");
    expect(crumbs.map((c) => c.label)).toEqual([
      "Dashboard",
      "Leagues",
      "Members",
    ]);
    // The id is invisible as a label but preserved in the Members link.
    expect(crumbs.at(-1)!.href).toBe("/dashboard/leagues/abc123XYZ/members");
  });

  it("ignores unknown trailing segments (e.g. a bare league id)", () => {
    expect(breadcrumbsForPath("/dashboard/leagues/abc123").map((c) => c.label)).toEqual([
      "Dashboard",
      "Leagues",
    ]);
  });

  it("handles a deep nested path", () => {
    expect(
      breadcrumbsForPath("/dashboard/teams/t1/roster").map((c) => c.label),
    ).toEqual(["Dashboard", "Teams", "Roster"]);
  });
});
