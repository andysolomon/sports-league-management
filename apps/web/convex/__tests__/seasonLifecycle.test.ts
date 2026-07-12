/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { selectLifecycleSeason, selectNewestSeason } from "../lib/seasonLifecycle";

const season = (
  id: string,
  status: string,
  name: string,
  startDate: string,
) => ({
  _id: id as never,
  _creationTime: 1,
  status,
  name,
  startDate,
  endDate: null,
});

describe("season lifecycle selection", () => {
  it("prefers the newest active season over all upcoming candidates", () => {
    const olderActive = season("active-1", "active", "2025", "2025-09-01");
    const newestActive = season("active-2", "active", "2026", "2026-09-01");
    const upcoming = season("upcoming", "upcoming", "2027", "2027-09-01");
    expect(selectLifecycleSeason([olderActive, upcoming, newestActive])).toBe(newestActive);
  });

  it("selects the newest upcoming season deterministically when there is no active season", () => {
    const earlier = season("upcoming-1", "upcoming", "2026", "2026-09-01");
    const latest = season("upcoming-2", "upcoming", "2027", "2027-09-01");
    expect(selectLifecycleSeason([earlier, latest])).toBe(latest);
  });

  it("selects the newest eligible completed rollover source", () => {
    const older = season("completed-1", "completed", "2025", "2025-09-01");
    const latest = season("completed-2", "completed", "2026", "2026-09-01");
    expect(selectNewestSeason([older, latest])).toBe(latest);
  });
});
