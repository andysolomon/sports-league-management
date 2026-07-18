import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResourceHeader } from "../ResourceHeader";

describe("ResourceHeader", () => {
  it("identifies the resource, links the parent home, and exposes sibling nav", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "team",
        name: "Dallas Cowboys",
        href: "/dashboard/teams/team-1",
        subtitle: "Team overview",
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
    expect(html).toContain('href="/dashboard/teams/team-1"');
    expect(html).toContain("Dallas Cowboys");
    expect(html).toContain('aria-label="team sections"');
    expect(html).toContain('aria-current="page"');
  });

  it("renders the active sibling indicator only for the current path", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "team",
        name: "Dallas Cowboys",
        href: "/dashboard/teams/team-1",
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
    // React's attribute order isn't stable, so check both orders.
    const rosterActive = /aria-current="page"[^>]*href="\/dashboard\/teams\/team-1\/roster"/.test(
      html,
    ) || /href="\/dashboard\/teams\/team-1\/roster"[^>]*aria-current="page"/.test(html);
    expect(rosterActive).toBe(true);
    const overviewActive = /aria-current="page"[^>]*href="\/dashboard\/teams\/team-1"/.test(
      html,
    );
    expect(overviewActive).toBe(false);
  });

  it("treats sibling hrefs with query strings as the same path", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "league",
        name: "NFL",
        href: "/dashboard/leagues/l1",
        siblings: [
          { label: "Schedule", href: "/dashboard/leagues/l1/schedule?season=s1" },
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
        name: "Dak Prescott",
        href: "/dashboard/players/p1",
      }),
    );
    expect(html).not.toContain("sections");
    expect(html).toContain('href="/dashboard/players/p1"');
  });

  it("renders status, context, and actions slots when provided", () => {
    const html = renderToStaticMarkup(
      createElement(ResourceHeader, {
        kind: "league",
        name: "NFL",
        href: "/dashboard/leagues/l1",
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
        name: "2025 Season",
        href: "/dashboard/seasons/s1",
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
          name: `X ${kind}`,
          href: `/dashboard/${kind}s/1`,
        }),
      );
      expect(html).toContain(`data-testid="resource-header-${kind}"`);
    }
  });
});