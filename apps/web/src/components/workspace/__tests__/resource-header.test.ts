import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResourceHeader } from "../ResourceHeader";

function linkMarkup(html: string, label: string): string {
  const match = html.match(new RegExp(`<a[^>]*>${label}</a>`));
  expect(match).toBeTruthy();
  return match![0];
}

describe("ResourceHeader", () => {
  it("titles the page with an h1 and exposes sibling nav", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "team",
        title: "Roster",
        homeHref: "/dashboard/teams/team-1",
        context: "Dallas Cowboys",
        siblings: [
          { label: "Overview", href: "/dashboard/teams/team-1" },
          { label: "Roster", href: "/dashboard/teams/team-1/roster" },
          {
            label: "Depth chart",
            href: "/dashboard/teams/team-1/depth-chart",
          },
        ],
        currentHref: "/dashboard/teams/team-1/roster",
      }),
    );
    expect(html).toContain('data-testid="resource-header-team"');
    expect(html).toContain('aria-label="team header"');
    expect(html).toMatch(/<h1[^>]*>Roster<\/h1>/);
    expect(html).toContain("Dallas Cowboys");
    expect(html).toContain('aria-label="team sections"');
    expect(html).toContain('aria-current="page"');
  });

  it("renders the context line as plain text, never as a link", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "season",
        title: "Schedule",
        homeHref: "/dashboard/seasons/s1",
        context: "2028 · Cobb County Football",
      }),
    );
    // The ancestry line is orientation only — no anchor wraps it.
    expect(html).toContain("2028 · Cobb County Football");
    expect(html).not.toMatch(/<a[^>]*>2028/);
    expect(html).not.toMatch(/<a[^>]*>Cobb County Football<\/a>/);
  });

  it("does not link the title", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "league",
        title: "Cobb County Football",
        homeHref: "/dashboard/leagues/l1",
      }),
    );
    expect(html).toMatch(/<h1[^>]*>Cobb County Football<\/h1>/);
    // With no siblings there is nothing to link at all.
    expect(html).not.toContain("<a");
  });

  it("renders the active sibling indicator only for the current path", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "team",
        title: "Roster",
        homeHref: "/dashboard/teams/team-1",
        siblings: [
          { label: "Overview", href: "/dashboard/teams/team-1" },
          { label: "Roster", href: "/dashboard/teams/team-1/roster" },
        ],
        currentHref: "/dashboard/teams/team-1/roster",
      }),
    );
    // Exactly one sibling is marked current.
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    // The Roster link carries the indicator; the Overview link does not.
    expect(linkMarkup(html, "Roster")).toContain('aria-current="page"');
    expect(linkMarkup(html, "Overview")).not.toContain('aria-current="page"');
  });

  it("keeps roster active on roster audit child routes", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "team",
        title: "Roster audit log",
        homeHref: "/dashboard/teams/team-1",
        siblings: [
          { label: "Overview", href: "/dashboard/teams/team-1" },
          { label: "Roster", href: "/dashboard/teams/team-1/roster" },
          {
            label: "Depth chart",
            href: "/dashboard/teams/team-1/depth-chart",
          },
        ],
        currentHref: "/dashboard/teams/team-1/roster/audit",
      }),
    );
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(linkMarkup(html, "Roster")).toContain('aria-current="page"');
    expect(linkMarkup(html, "Overview")).not.toContain('aria-current="page"');
    expect(linkMarkup(html, "Depth chart")).not.toContain(
      'aria-current="page"',
    );
  });

  it("does not mark prefix-only sibling routes as active", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "team",
        title: "Roster",
        homeHref: "/dashboard/teams/team-1",
        siblings: [
          { label: "Overview", href: "/dashboard/teams/team-1" },
          { label: "Roster", href: "/dashboard/teams/team-1/roster" },
        ],
        currentHref: "/dashboard/teams/team-1/roster-audit",
      }),
    );
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(0);
  });

  it("treats sibling hrefs with query strings as the same path", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "league",
        title: "Schedule",
        homeHref: "/dashboard/leagues/l1",
        siblings: [
          {
            label: "Schedule",
            href: "/dashboard/leagues/l1/schedule?season=s1",
          },
        ],
        currentHref: "/dashboard/leagues/l1/schedule",
      }),
    );
    expect(html).toContain('aria-current="page"');
  });

  it("omits the sibling nav when no siblings are supplied", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "player",
        title: "Dak Prescott",
        homeHref: "/dashboard/players/p1",
      }),
    );
    expect(html).not.toContain("sections");
  });

  it("renders status, context, and actions slots when provided", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "league",
        title: "NFL",
        homeHref: "/dashboard/leagues/l1",
        status: createElement("span", { "data-testid": "status" }, "Active"),
        context: createElement("span", null, "8 teams"),
        actions: createElement("button", { type: "button" }, "Manage"),
      }),
    );
    expect(html).toContain('data-testid="status"');
    expect(html).toContain("8 teams");
    expect(html).toContain("Manage");
  });

  it("does not render any breadcrumb separators or back-link affordances", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "season",
        title: "2025 Season",
        homeHref: "/dashboard/seasons/s1",
      }),
    );
    expect(html).not.toContain("lucide-chevron-right");
    expect(html).not.toContain("Back to");
  });

  it("includes a Resource Header testid for every kind", () => {
    const kinds = ["league", "team", "player", "season"] as const;
    for (const kind of kinds) {
      const html = renderToStaticMarkup(
        createElement(ResourceHeader, {
          kind,
          title: `X ${kind}`,
          homeHref: `/dashboard/${kind}s/1`,
        }),
      );
      expect(html).toContain(`data-testid="resource-header-${kind}"`);
    }
  });
});
