import { describe, it, expect } from "vitest";
import type { PlayerDto } from "@sports-management/shared-types";
import {
  filterPlayers,
  matchesPositionSideGroup,
  paginatePlayers,
  positionSideGroup,
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

describe("positionSideGroup", () => {
  it("maps offense, defense, and special positions", () => {
    expect(positionSideGroup("qb")).toBe("off");
    expect(positionSideGroup("ILB")).toBe("def");
    expect(positionSideGroup("P")).toBe("st");
    expect(positionSideGroup("MF")).toBeNull();
  });
});

describe("matchesPositionSideGroup", () => {
  it("filters by side group", () => {
    expect(matchesPositionSideGroup("QB", "off")).toBe(true);
    expect(matchesPositionSideGroup("QB", "def")).toBe(false);
    expect(matchesPositionSideGroup("QB", "all")).toBe(true);
  });
});

describe("filterPlayers", () => {
  it("filters by position side and search query", () => {
    const offense = filterPlayers(roster, "", "off");
    expect(offense.map((p) => p.id)).toEqual(["p1", "p2"]);

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
