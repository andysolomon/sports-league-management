import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LeagueDto, SeasonDto } from "@sports-management/shared-types";
import { DashboardOverview, findActiveSeason } from "../dashboard-overview";

function season(status: string): SeasonDto {
  return {
    id: `season-${status}`,
    name: `Season ${status}`,
    leagueId: "league-1",
    startDate: null,
    endDate: null,
    status,
    rosterLocked: false,
    playoffTeams: null,
    playoffFormat: null,
    divisionWinnersQualify: false,
    simulationFlavor: "balanced",
  };
}

describe("findActiveSeason", () => {
  it("returns the season whose status is active (case-insensitive)", () => {
    const seasons = [season("Completed"), season("Active"), season("Upcoming")];
    expect(findActiveSeason(seasons)?.id).toBe("season-Active");
  });

  it("returns null when no season is active", () => {
    const seasons = [season("Completed"), season("Upcoming")];
    expect(findActiveSeason(seasons)).toBeNull();
  });

  it("returns null for an empty season list", () => {
    expect(findActiveSeason([])).toBeNull();
  });
});

const league: LeagueDto = {
  id: "league-1",
  name: "Test League",
  orgId: "org-1",
};

describe("DashboardOverview", () => {
  it("renders spec copy and stat rows when an active season exists", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardOverview, {
        league,
        activeSeason: season("Active"),
        teamCount: 16,
        progress: { total: 11, final: 8, complete: false },
        standings: [],
        standingsLinkEnabled: true,
      }),
    );
    expect(html).toContain("Active season");
    expect(html).toContain("Regular season");
    expect(html).toContain("8 / 11 played");
    expect(html).toContain("Open league");
    expect(html).toContain("Seasons");
    expect(html).toContain("Standings");
    expect(html).toContain("Full standings →");
  });

  it("renders EmptyState with guidance when there is no active season", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardOverview, {
        league,
        activeSeason: null,
        teamCount: 4,
        progress: { total: 0, final: 0, complete: true },
        standings: [],
        standingsLinkEnabled: false,
      }),
    );
    expect(html).toContain('data-testid="overview-no-active-season"');
    expect(html).toContain("No active season");
    expect(html).toContain("Activate or create a season");
    expect(html).toContain('href="/dashboard/seasons"');
    expect(html).not.toContain('data-testid="dashboard-overview"');
    expect(html).not.toContain('data-testid="overview-season-progress"');
  });
});
