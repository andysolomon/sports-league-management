import { describe, it, expect } from "vitest";
import {
  filterAndSortFreeAgents,
  type FreeAgentRow,
} from "@/lib/offseason-free-agency";

const AGENTS: FreeAgentRow[] = [
  {
    id: "p1",
    name: "Alex Alpha",
    position: "QB",
    grade: 12,
    overall: 88,
    teamId: "t1",
  },
  {
    id: "p2",
    name: "Ben Beta",
    position: "WR",
    grade: 11,
    overall: 72,
    teamId: "t1",
  },
  {
    id: "p3",
    name: "Cal Gamma",
    position: "QB",
    grade: 10,
    overall: null,
    teamId: "t2",
  },
];

describe("filterAndSortFreeAgents", () => {
  it("sorts by overall descending by default", () => {
    const rows = filterAndSortFreeAgents(
      AGENTS,
      { position: "all", classYear: "all" },
      "overall",
    );
    expect(rows.map((row) => row.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("narrows rows by position and class filters", () => {
    const rows = filterAndSortFreeAgents(
      AGENTS,
      { position: "QB", classYear: "SO" },
      "name",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("p3");
  });

  it("sorts by name when requested", () => {
    const rows = filterAndSortFreeAgents(
      AGENTS,
      { position: "all", classYear: "all" },
      "name",
    );
    expect(rows.map((row) => row.name)).toEqual([
      "Alex Alpha",
      "Ben Beta",
      "Cal Gamma",
    ]);
  });
});
