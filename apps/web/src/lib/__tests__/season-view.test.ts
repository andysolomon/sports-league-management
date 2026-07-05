import { describe, expect, it } from "vitest";
import type { SeasonDto } from "@sports-management/shared-types";
import { resolveViewedSeason } from "../season-view";

function season(id: string, status: string): SeasonDto {
  return {
    id,
    name: `Season ${id}`,
    leagueId: "league1",
    status,
    startDate: null,
    endDate: null,
    rosterLocked: false,
    playoffTeams: null,
    playoffFormat: null,
    divisionWinnersQualify: false,
  };
}

const finished = season("s1", "upcoming");
const active = season("s2", "active");
const older = season("s3", "upcoming");

describe("resolveViewedSeason", () => {
  it("returns the requested season when the id belongs to the league", () => {
    expect(resolveViewedSeason([finished, active, older], "s3")).toBe(older);
  });

  it("falls back to the active season for an unknown id", () => {
    expect(resolveViewedSeason([finished, active], "nope")).toBe(active);
  });

  it("falls back to the active season with no param", () => {
    expect(resolveViewedSeason([finished, active], undefined)).toBe(active);
  });

  it("falls back to the first season when none is active", () => {
    expect(resolveViewedSeason([finished, older], undefined)).toBe(finished);
  });

  it("returns null for a league with no seasons", () => {
    expect(resolveViewedSeason([], "s1")).toBeNull();
  });
});
