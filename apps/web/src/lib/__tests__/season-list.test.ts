import { describe, expect, it } from "vitest";
import { formatSeasonRecord, seasonSortYear, sortSeasons } from "../season-list";

describe("season-list helpers", () => {
  it("sorts active seasons first then year descending", () => {
    const seasons = [
      { id: "1", name: "2024 Season", startDate: "2024-09-01", status: "completed" },
      { id: "2", name: "2026 Season", startDate: "2026-09-01", status: "upcoming" },
      { id: "3", name: "2025 Season", startDate: "2025-09-01", status: "active" },
    ];
    expect(sortSeasons(seasons).map((s) => s.id)).toEqual(["3", "2", "1"]);
  });

  it("derives year from season name when start date is missing", () => {
    expect(seasonSortYear({ name: "Cobb Football 2028", startDate: null })).toBe(2028);
  });

  it("formats W-L-T records", () => {
    expect(formatSeasonRecord(10, 2, 0)).toBe("10-2");
    expect(formatSeasonRecord(8, 3, 1)).toBe("8-3-1");
  });
});
