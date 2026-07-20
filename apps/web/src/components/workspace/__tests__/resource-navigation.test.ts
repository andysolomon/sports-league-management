import { describe, it, expect } from "vitest";
import {
  accountBillingHref,
  accountImportHref,
  accountSettingsHref,
  activeSeasonShortcutHref,
  buildPlayerSiblingLinks,
  buildSeasonSiblingLinks,
  buildTeamSiblingLinks,
  dashboardEntryPath,
  isActiveHref,
  leagueActivationHref,
  leagueDirectoryHref,
  leagueHomeHref,
  leagueSettingsHref,
  leagueSubpageHref,
  playerHomeHref,
  playerSubpageHref,
  seasonHomeHref,
  seasonSubpageHref,
  settingsHomeHref,
  teamHomeHref,
  teamSubpageHref,
} from "../resource-navigation";

describe("resource-navigation helpers", () => {
  it("returns canonical home hrefs", () => {
    expect(leagueHomeHref("l1")).toBe("/dashboard/leagues/l1");
    expect(teamHomeHref("t1")).toBe("/dashboard/teams/t1");
    expect(playerHomeHref("p1")).toBe("/dashboard/players/p1");
    expect(seasonHomeHref("s1")).toBe("/dashboard/seasons/s1");
  });

  it("player hrefs never carry ?from= orientation queries (ASR-19 / #574)", () => {
    expect(playerHomeHref("p1")).not.toContain("?");
    expect(playerSubpageHref("p1", "development")).not.toContain("?");
    for (const link of buildPlayerSiblingLinks({
      playerId: "p1",
      developmentEnabled: true,
    })) {
      expect(link.href).not.toContain("?");
      expect(link.href).not.toMatch(/[?&]from=/);
    }
  });

  it("returns the League Directory href", () => {
    expect(leagueDirectoryHref()).toBe("/dashboard/leagues");
  });

  it("returns Settings tree hrefs — the redirect targets for legacy import/billing/manage (issue #576)", () => {
    expect(settingsHomeHref()).toBe("/dashboard/settings");
    expect(leagueSettingsHref()).toBe("/dashboard/settings/league");
    expect(accountSettingsHref()).toBe("/dashboard/settings/account");
    expect(accountImportHref()).toBe("/dashboard/settings/account/import");
    expect(accountBillingHref()).toBe("/dashboard/settings/account/billing");
  });

  it("resolves dashboard entry paths", () => {
    expect(dashboardEntryPath("league-1")).toBe("/dashboard/leagues/league-1");
    expect(dashboardEntryPath(null)).toBe("/dashboard/leagues");
  });

  it("builds league activation hrefs through the active-league route", () => {
    expect(leagueActivationHref("league-1")).toBe(
      "/dashboard/active-league?leagueId=league-1&returnTo=%2Fdashboard%2Fleagues%2Fleague-1",
    );
    expect(leagueActivationHref("league/a")).toBe(
      "/dashboard/active-league?leagueId=league%2Fa&returnTo=%2Fdashboard%2Fleagues%2Fleague%2Fa",
    );
  });

  it("builds active-season shortcuts through the active-league route", () => {
    expect(activeSeasonShortcutHref("league-1", "season-1")).toBe(
      "/dashboard/active-league?leagueId=league-1&returnTo=%2Fdashboard%2Fseasons%2Fseason-1",
    );
    expect(activeSeasonShortcutHref("league/a", "season/b")).toBe(
      "/dashboard/active-league?leagueId=league%2Fa&returnTo=%2Fdashboard%2Fseasons%2Fseason%2Fb",
    );
  });

  it("appends ?season= to legacy league subpages when active season provided", () => {
    expect(leagueSubpageHref("l1", "schedule", "s1")).toBe(
      "/dashboard/leagues/l1/schedule?season=s1",
    );
    expect(leagueSubpageHref("l1", "schedule", null)).toBe(
      "/dashboard/leagues/l1/schedule",
    );
  });

  it("builds team, player, and season subpage hrefs", () => {
    expect(teamSubpageHref("t1", "roster")).toBe("/dashboard/teams/t1/roster");
    expect(teamSubpageHref("t1", "depth-chart")).toBe(
      "/dashboard/teams/t1/depth-chart",
    );
    expect(playerSubpageHref("p1", "development")).toBe(
      "/dashboard/players/p1/development",
    );
    expect(seasonSubpageHref("s1", "schedule")).toBe(
      "/dashboard/seasons/s1/schedule",
    );
    expect(seasonSubpageHref("s1", "standings")).toBe(
      "/dashboard/seasons/s1/standings",
    );
    expect(seasonSubpageHref("s1", "playoffs")).toBe(
      "/dashboard/seasons/s1/playoffs",
    );
    expect(seasonSubpageHref("s1", "stats")).toBe(
      "/dashboard/seasons/s1/stats",
    );
  });
});

describe("buildTeamSiblingLinks", () => {
  it("includes Overview always and gates Roster and Depth Chart", () => {
    const all = buildTeamSiblingLinks({
      teamId: "t1",
      rosterEnabled: true,
      depthChartEnabled: true,
    });
    expect(all.map((l) => l.label)).toEqual([
      "Overview",
      "Roster",
      "Depth chart",
    ]);

    const rosterOnly = buildTeamSiblingLinks({
      teamId: "t1",
      rosterEnabled: true,
      depthChartEnabled: false,
    });
    expect(rosterOnly.map((l) => l.label)).toEqual(["Overview", "Roster"]);

    const none = buildTeamSiblingLinks({
      teamId: "t1",
      rosterEnabled: false,
      depthChartEnabled: false,
    });
    expect(none.map((l) => l.label)).toEqual(["Overview"]);
  });
});

describe("buildPlayerSiblingLinks", () => {
  it("includes Overview always and gates Development", () => {
    expect(
      buildPlayerSiblingLinks({
        playerId: "p1",
        developmentEnabled: true,
      }).map((l) => l.label),
    ).toEqual(["Overview", "Development"]);

    expect(
      buildPlayerSiblingLinks({
        playerId: "p1",
        developmentEnabled: false,
      }).map((l) => l.label),
    ).toEqual(["Overview"]);
  });
});

describe("buildSeasonSiblingLinks", () => {
  it("includes Schedule and Standings under the schedule flag, plus Playoffs and Stat Leaders", () => {
    const links = buildSeasonSiblingLinks({
      seasonId: "s1",
      scheduleEnabled: true,
      playoffsEnabled: true,
      statsEnabled: true,
    });
    expect(links.map((l) => l.label)).toEqual([
      "Overview",
      "Schedule",
      "Standings",
      "Playoffs",
      "Stat leaders",
    ]);
    // Overview points at Season Home; siblings are canonical Season-owned
    // competition routes (no ?season=).
    expect(links[0]!.href).toBe("/dashboard/seasons/s1");
    expect(links.map((l) => l.href)).toEqual([
      "/dashboard/seasons/s1",
      "/dashboard/seasons/s1/schedule",
      "/dashboard/seasons/s1/standings",
      "/dashboard/seasons/s1/playoffs",
      "/dashboard/seasons/s1/stats",
    ]);
  });

  it("omits feature-disabled siblings", () => {
    const links = buildSeasonSiblingLinks({
      seasonId: "s1",
      scheduleEnabled: false,
      playoffsEnabled: false,
      statsEnabled: false,
    });
    expect(links.map((l) => l.label)).toEqual(["Overview"]);
  });
});

describe("isActiveHref", () => {
  it("matches exact path", () => {
    expect(isActiveHref("/dashboard/teams/t1", "/dashboard/teams/t1")).toBe(true);
  });

  it("matches child paths", () => {
    expect(
      isActiveHref("/dashboard/teams/t1/roster", "/dashboard/teams/t1"),
    ).toBe(true);
  });

  it("ignores query strings when comparing", () => {
    expect(
      isActiveHref(
        "/dashboard/leagues/l1/schedule",
        "/dashboard/leagues/l1/schedule?season=s1",
      ),
    ).toBe(true);
  });

  it("does not match unrelated paths", () => {
    expect(isActiveHref("/dashboard/teams/t1", "/dashboard/teams/t2")).toBe(
      false,
    );
    expect(isActiveHref(null, "/dashboard/teams/t1")).toBe(false);
  });
});