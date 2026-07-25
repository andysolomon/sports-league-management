import { describe, it, expect } from "vitest";
import type { PlayerDto } from "@sports-management/shared-types";
import {
  buildPositionFilterOptions,
  filterPlayers,
  matchesPositionFilter,
  paginatePlayers,
  playerPositionGroup,
  positionSide,
  sortPlayers,
  type DirectoryPlayer,
} from "../players-directory";

function player(
  overrides: Partial<DirectoryPlayer> & Pick<DirectoryPlayer, "id" | "name" | "position">,
): DirectoryPlayer {
  return {
    teamId: "t1",
    teamName: "Alpha",
    teamPrimaryColor: null,
    positionGroup: null,
    jerseyNumber: 1,
    dateOfBirth: null,
    status: "Active",
    headshotUrl: null,
    experienceYears: null,
    grade: null,
    squad: null,
    hometown: null,
    overallRating: 80,
    ...overrides,
  };
}

const roster: DirectoryPlayer[] = [
  player({ id: "p1", name: "Aaron Adams", position: "QB", jerseyNumber: 4, overallRating: 92 }),
  player({ id: "p2", name: "Ben Brown", position: "WR", teamName: "Bravo", overallRating: 85 }),
  player({ id: "p3", name: "Carl Clark", position: "CB", overallRating: 78 }),
  player({ id: "p4", name: "Dan Davis", position: "K", overallRating: 70 }),
];

describe("positionSide", () => {
  it("maps offense, defense, and special positions", () => {
    expect(positionSide("qb")).toBe("off");
    expect(positionSide("ILB")).toBe("def");
    expect(positionSide("P")).toBe("st");
    expect(positionSide("MF")).toBeNull();
  });
});

describe("playerPositionGroup", () => {
  it("buckets a position into its group, or Other", () => {
    expect(playerPositionGroup("qb")).toBe("QB");
    expect(playerPositionGroup("ILB")).toBe("LB");
    expect(playerPositionGroup("SS")).toBe("DB");
    expect(playerPositionGroup("P")).toBe("K/P");
    expect(playerPositionGroup("MF")).toBe("Other");
  });
});

describe("matchesPositionFilter", () => {
  it("filters by position group", () => {
    expect(matchesPositionFilter("QB", "QB")).toBe(true);
    expect(matchesPositionFilter("QB", "WR")).toBe(false);
    expect(matchesPositionFilter("QB", "all")).toBe(true);
    // Sub-positions match their group, not their own label.
    expect(matchesPositionFilter("ILB", "LB")).toBe(true);
  });
});

describe("buildPositionFilterOptions", () => {
  it("offers All plus only the groups present, in football order", () => {
    const options = buildPositionFilterOptions(roster);
    expect(options.map((o) => o.value)).toEqual([
      "all",
      "QB",
      "WR",
      "DB",
      "K/P",
    ]);
    expect(options[0]).toMatchObject({ label: "All", count: 4 });
    expect(options.every((o) => o.count > 0)).toBe(true);
  });

  it("puts unmappable positions in a trailing Other bucket", () => {
    const options = buildPositionFilterOptions([
      ...roster,
      player({ id: "p5", name: "Eli Evans", position: "MF" }),
    ]);
    expect(options.at(-1)).toMatchObject({ value: "Other", count: 1 });
  });
});

describe("filterPlayers", () => {
  it("filters by position group and search query", () => {
    const quarterbacks = filterPlayers(roster, "", "QB");
    expect(quarterbacks.map((p) => p.id)).toEqual(["p1"]);

    const defensiveBacks = filterPlayers(roster, "", "DB");
    expect(defensiveBacks.map((p) => p.id)).toEqual(["p3"]);

    const searched = filterPlayers(roster, "bravo", "all");
    expect(searched).toHaveLength(1);
    expect(searched[0]?.name).toBe("Ben Brown");
  });
});

describe("sortPlayers", () => {
  it("sorts by rating descending by default", () => {
    const sorted = sortPlayers(roster, { key: "rating", dir: "desc" });
    expect(sorted.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("sorts strings ascending with name tie-breaker", () => {
    const sorted = sortPlayers(roster, { key: "name", dir: "asc" });
    expect(sorted.map((p) => p.name)).toEqual([
      "Aaron Adams",
      "Ben Brown",
      "Carl Clark",
      "Dan Davis",
    ]);
  });
});

describe("paginatePlayers", () => {
  it("returns the requested page slice", () => {
    const page = paginatePlayers(roster, 2, 2);
    expect(page.safePage).toBe(2);
    expect(page.totalPages).toBe(2);
    expect(page.pageItems.map((p) => p.id)).toEqual(["p3", "p4"]);
    expect(page.startIndex).toBe(2);
  });
});
