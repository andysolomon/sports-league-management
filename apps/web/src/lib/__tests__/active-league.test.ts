import { describe, expect, it } from "vitest";
import type { LeagueDto } from "@sports-management/shared-types";
import { selectActiveLeaguePreference } from "../active-league";
import {
  isActiveLeagueResourcePath,
  leagueHomePath,
  normalizeDashboardReturnPath,
} from "../active-league-cookie";

function league(id: string, orgId: string | null, name = id): LeagueDto {
  return { id, orgId, name };
}

describe("selectActiveLeaguePreference", () => {
  const leagues = [
    league("public-a", null, "A Public"),
    league("owned-b", "org-1", "B Owned"),
    league("owned-c", "org-2", "C Owned"),
  ];
  const orgContext = { orgIds: ["org-1"] };

  it("keeps a valid saved preference", () => {
    expect(
      selectActiveLeaguePreference({
        leagues,
        orgContext,
        preferredLeagueId: "owned-c",
      }),
    ).toMatchObject({
      activeLeagueId: "owned-c",
      status: "valid",
    });
  });

  it("uses owned-first fallback when the preference is missing", () => {
    expect(
      selectActiveLeaguePreference({
        leagues,
        orgContext,
        preferredLeagueId: null,
      }),
    ).toMatchObject({
      activeLeagueId: "owned-b",
      status: "missing",
    });
  });

  it("uses the deterministic fallback when the preference is stale", () => {
    expect(
      selectActiveLeaguePreference({
        leagues,
        orgContext,
        preferredLeagueId: "deleted-league",
      }),
    ).toMatchObject({
      activeLeagueId: "owned-b",
      status: "stale",
    });
  });

  it("falls back to the first visible league when none are owned", () => {
    expect(
      selectActiveLeaguePreference({
        leagues: [league("public-a", null), league("public-b", null)],
        orgContext,
        preferredLeagueId: null,
      }),
    ).toMatchObject({
      activeLeagueId: "public-a",
      status: "missing",
    });
  });

  it("marks a saved preference stale when no leagues remain visible", () => {
    expect(
      selectActiveLeaguePreference({
        leagues: [],
        orgContext,
        preferredLeagueId: "deleted-league",
      }),
    ).toEqual({ activeLeagueId: null, activeLeague: null, status: "stale" });
  });

  it("returns none when no leagues or preference exist", () => {
    expect(
      selectActiveLeaguePreference({
        leagues: [],
        orgContext,
        preferredLeagueId: null,
      }),
    ).toEqual({ activeLeagueId: null, activeLeague: null, status: "none" });
  });
});

describe("dashboard active-league path helpers", () => {
  it("normalizes only dashboard-local return paths", () => {
    expect(
      normalizeDashboardReturnPath("/dashboard/teams?view=divisions"),
    ).toBe("/dashboard/teams?view=divisions");
    expect(normalizeDashboardReturnPath("https://evil.test/dashboard")).toBe(
      "/dashboard",
    );
    expect(normalizeDashboardReturnPath("//evil.test/dashboard")).toBe(
      "/dashboard",
    );
    expect(normalizeDashboardReturnPath("/settings")).toBe("/dashboard");
  });

  it("classifies only resource deep links as resource paths", () => {
    expect(isActiveLeagueResourcePath("/dashboard/leagues/league-1")).toBe(true);
    expect(isActiveLeagueResourcePath("/dashboard/teams/team-1/roster")).toBe(
      true,
    );
    expect(isActiveLeagueResourcePath("/dashboard/games/game-1/boxscore")).toBe(
      true,
    );
    expect(isActiveLeagueResourcePath("/dashboard/leagues")).toBe(false);
    expect(isActiveLeagueResourcePath("/dashboard")).toBe(false);
  });

  it("builds the selected league home path", () => {
    expect(leagueHomePath("league-1")).toBe("/dashboard/leagues/league-1");
  });
});
