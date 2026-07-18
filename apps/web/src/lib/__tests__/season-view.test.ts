import { describe, expect, it } from "vitest";
import type { SeasonDto } from "@sports-management/shared-types";
import {
  findActiveSeason,
  resolveLifecycleSeason,
  resolveViewedSeason,
} from "../season-view";

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
    simulationFlavor: "balanced",
  };
}

const finished = season("s1", "completed");
const active = season("s2", "active");
const older = season("s3", "upcoming");

describe("findActiveSeason", () => {
  it("returns the single active season", () => {
    expect(findActiveSeason([finished, active, older])).toBe(active);
  });

  it("returns null when no season is active", () => {
    expect(findActiveSeason([finished, older])).toBeNull();
    expect(findActiveSeason([])).toBeNull();
  });

  it("resolves a multi-active conflict to the newest, deterministically", () => {
    const olderActive = { ...active, id: "s-active-1", name: "2025", startDate: "2025-09-01" };
    const latestActive = { ...active, id: "s-active-2", name: "2026", startDate: "2026-09-01" };
    expect(findActiveSeason([olderActive, finished, latestActive])).toBe(latestActive);
    expect(findActiveSeason([latestActive, finished, olderActive])).toBe(latestActive);
  });
});

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

  it("falls back to an upcoming season when none is active", () => {
    expect(resolveViewedSeason([finished, older], undefined)).toBe(older);
  });

  it("chooses the newest upcoming season when lifecycle data conflicts", () => {
    const earlier = { ...older, id: "s-up-1", name: "2026", startDate: "2026-09-01" };
    const latest = { ...older, id: "s-up-2", name: "2027", startDate: "2027-09-01" };
    expect(resolveLifecycleSeason([finished, earlier, latest])).toBe(latest);
  });

  it("resolves an active conflict deterministically before upcoming seasons", () => {
    const olderActive = { ...active, id: "s-active-1", name: "2025", startDate: "2025-09-01" };
    const latestActive = { ...active, id: "s-active-2", name: "2026", startDate: "2026-09-01" };
    expect(resolveLifecycleSeason([olderActive, older, latestActive])).toBe(latestActive);
  });

  it("falls back to the most recent historical season when neither is current", () => {
    const old = { ...finished, name: "2024", startDate: "2024-09-01" };
    const recent = { ...finished, id: "s4", name: "2026", startDate: "2026-09-01" };
    expect(resolveViewedSeason([old, recent], undefined)).toBe(recent);
  });

  it("returns null for a league with no seasons", () => {
    expect(resolveViewedSeason([], "s1")).toBeNull();
  });
});
