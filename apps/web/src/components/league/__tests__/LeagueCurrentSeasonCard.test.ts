import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeagueCurrentSeasonCard } from "../LeagueCurrentSeasonCard";

const season = {
  id: "season-1",
  name: "2026",
  status: "active",
  playoffTeams: 4,
  playoffFormat: "single",
};

describe("LeagueCurrentSeasonCard", () => {
  it("renders the no-active-season empty state with Seasons Home for everyone", () => {
    const html = renderToStaticMarkup(
      createElement(LeagueCurrentSeasonCard, {
        season: null,
        progress: { final: 0, total: 0 },
        navLinks: [],
        isAdmin: false,
      }),
    );

    expect(html).toContain('data-testid="league-no-active-season"');
    expect(html).toContain("No active season");
    expect(html).toContain('href="/dashboard/seasons"');
    expect(html).toContain("Seasons Home");
    expect(html).not.toContain("Manage seasons");
  });

  it("adds the admin-only manage-seasons CTA in the empty state", () => {
    const html = renderToStaticMarkup(
      createElement(LeagueCurrentSeasonCard, {
        season: null,
        progress: { final: 0, total: 0 },
        navLinks: [],
        isAdmin: true,
      }),
    );

    expect(html).toContain("Manage seasons");
    expect(html).toContain('href="/dashboard/seasons"');
  });

  it("keeps the active-season rendering path unchanged", () => {
    const html = renderToStaticMarkup(
      createElement(LeagueCurrentSeasonCard, {
        season,
        progress: { final: 3, total: 10 },
        navLinks: [{ href: "/dashboard/seasons/season-1", label: "Overview" }],
        isAdmin: false,
      }),
    );

    expect(html).toContain('data-testid="league-current-season"');
    expect(html).toContain("2026");
    expect(html).toContain("3 / 10 played");
    expect(html).not.toContain('data-testid="league-no-active-season"');
  });
});
