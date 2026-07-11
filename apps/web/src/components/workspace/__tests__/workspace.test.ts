import { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Breadcrumbs } from "../Breadcrumbs";
import { BackLink } from "../BackLink";
import { WorkspaceHeader } from "../WorkspaceHeader";
import { WorkspaceNav } from "../WorkspaceNav";
import { buildLeagueSeasonNavLinks } from "../build-league-nav-links";

describe("Breadcrumbs", () => {
  it("renders linked crumbs and a plain-text terminal item", () => {
    const html = renderToStaticMarkup(
      createElement(Breadcrumbs, {
        items: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leagues", href: "/dashboard/leagues" },
          { label: "NFL" },
        ],
      }),
    );
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/dashboard/leagues"');
    expect(html).toContain("NFL");
    expect(html).not.toContain('href="/dashboard/leagues/NFL"');
    expect(html).toContain("›");
  });

  it("renders nothing when items are empty", () => {
    const html = renderToStaticMarkup(
      createElement(Breadcrumbs, { items: [] }),
    );
    expect(html).toBe("");
  });
});

describe("BackLink", () => {
  it("threads href and label", () => {
    const html = renderToStaticMarkup(
      createElement(BackLink, {
        href: "/dashboard/leagues/league-1",
        label: "Back to League",
      }),
    );
    expect(html).toContain('href="/dashboard/leagues/league-1"');
    expect(html).toContain("Back to League");
  });
});

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
});

describe("WorkspaceNav", () => {
  it("renders accent links with arrow suffixes", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceNav, {
        links: [
          {
            href: "/dashboard/leagues/l1/schedule?season=s1",
            label: "Schedule",
          },
        ],
      }),
    );
    expect(html).toContain('aria-label="Workspace"');
    expect(html).toContain('href="/dashboard/leagues/l1/schedule?season=s1"');
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
  it("appends ?season= to every peer link", () => {
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
        href: "/dashboard/leagues/league-1/standings?season=season-9",
        label: "Standings",
      },
      {
        href: "/dashboard/leagues/league-1/playoffs?season=season-9",
        label: "Playoffs",
      },
      {
        href: "/dashboard/leagues/league-1/stats?season=season-9",
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
        href: "/dashboard/leagues/league-1/schedule?season=season-9",
        label: "Schedule",
      },
    ]);
  });

  it("omits ?season= when seasonId is null", () => {
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
