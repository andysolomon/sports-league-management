import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceHeader } from "../WorkspaceHeader";
import { WorkspaceNav } from "../WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "../build-league-nav-links";

describe("WorkspaceHeader", () => {
  it("renders title, status, sub line, and actions when provided", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceHeader, {
        title: "2025 Season",
        size: "sub-hub",
        status: createElement("span", { "data-testid": "status" }, "Active"),
        sub: createElement("span", null, "League context"),
        actions: createElement("button", { type: "button" }, "Rename"),
      }),
    );
    expect(html).toContain("2025 Season");
    expect(html).toContain('data-testid="status"');
    expect(html).toContain("League context");
    expect(html).toContain("Rename");
    expect(html).toContain("text-[28px]");
  });

  it("omits optional slots when not provided", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceHeader, { title: "National Football League" }),
    );
    expect(html).toContain("National Football League");
    expect(html).toContain("text-[30px]");
    expect(html).not.toContain("text-[28px]");
  });

  it("renders the nav slot inside the header block (WSM-000247)", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceHeader, {
        title: "2025 Season",
        size: "sub-hub",
        sub: createElement("span", null, "League context"),
        nav: createElement(WorkspaceNav, {
          links: [{ href: "/dashboard/seasons/s1/schedule", label: "Schedule" }],
        }),
      }),
    );
    const headerClose = html.indexOf("</header>");
    const navIndex = html.indexOf('aria-label="Workspace"');
    expect(navIndex).toBeGreaterThan(-1);
    expect(navIndex).toBeLessThan(headerClose);
    // Nav sits after the context line, per the prototype hub header.
    expect(navIndex).toBeGreaterThan(html.indexOf("League context"));
  });
});

describe("WorkspaceNav", () => {
  it("renders accent links with arrow suffixes", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceNav, {
        links: [
          {
            href: "/dashboard/seasons/s1/schedule",
            label: "Schedule",
          },
        ],
      }),
    );
    expect(html).toContain('aria-label="Workspace"');
    expect(html).toContain('href="/dashboard/seasons/s1/schedule"');
    expect(html).toContain("Schedule");
    expect(html).toContain("→");
  });

  it("renders nothing when links are empty", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceNav, { links: [] }),
    );
    expect(html).toBe("");
  });
});

describe("buildLeagueSeasonNavLinks", () => {
  it("emits canonical Season-owned peer links when a season is in context", () => {
    const links = buildLeagueSeasonNavLinks({
      leagueId: "league-1",
      seasonId: "season-9",
      scheduleEnabled: true,
      playoffsEnabled: true,
      statsEnabled: true,
      exclude: "schedule",
    });
    expect(links).toEqual([
      {
        href: "/dashboard/seasons/season-9/standings",
        label: "Standings",
      },
      {
        href: "/dashboard/seasons/season-9/playoffs",
        label: "Playoffs",
      },
      {
        href: "/dashboard/seasons/season-9/stats",
        label: "Stat leaders",
      },
    ]);
  });

  it("respects feature-flag gating", () => {
    const links = buildLeagueSeasonNavLinks({
      leagueId: "league-1",
      seasonId: "season-9",
      scheduleEnabled: true,
      playoffsEnabled: false,
      statsEnabled: false,
      exclude: "standings",
    });
    expect(links).toEqual([
      {
        href: "/dashboard/seasons/season-9/schedule",
        label: "Schedule",
      },
    ]);
  });

  it("falls back to legacy League-owned paths when seasonId is null", () => {
    const links = buildLeagueSeasonNavLinks({
      leagueId: "league-1",
      seasonId: null,
      scheduleEnabled: true,
      playoffsEnabled: true,
      statsEnabled: true,
      exclude: "stats",
    });
    expect(links.map((l) => l.href)).toEqual([
      "/dashboard/leagues/league-1/schedule",
      "/dashboard/leagues/league-1/standings",
      "/dashboard/leagues/league-1/playoffs",
    ]);
  });
});