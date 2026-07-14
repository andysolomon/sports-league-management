import { describe, it, expect } from "vitest";
import {
  computeTeamOvr,
  formLast5,
  mergeStandingsWithTeams,
  pickKeyPlayers,
  resultsMapFromSeasonLines,
  winPercentage,
} from "../teams-table";
import type { Standing } from "@sports-management/shared-types";

const standing = (
  teamId: string,
  name: string,
  rank: number,
  wins = 0,
  losses = 0,
): Standing => ({
  teamId,
  teamName: name,
  wins,
  losses,
  ties: 0,
  pointsFor: wins * 7,
  pointsAgainst: losses * 7,
  divisionRank: rank,
  leagueRank: rank,
});

describe("formLast5", () => {
  const fixtures = [
    {
      id: "f1",
      status: "final" as const,
      homeTeamId: "t1",
      awayTeamId: "t2",
    },
    {
      id: "f2",
      status: "final" as const,
      homeTeamId: "t3",
      awayTeamId: "t1",
    },
    {
      id: "f3",
      status: "scheduled" as const,
      homeTeamId: "t1",
      awayTeamId: "t4",
    },
    {
      id: "f4",
      status: "final" as const,
      homeTeamId: "t1",
      awayTeamId: "t5",
    },
  ];

  const results = resultsMapFromSeasonLines([
    { fixtureId: "f1", homeScore: 21, awayScore: 14 },
    { fixtureId: "f2", homeScore: 10, awayScore: 17 },
    { fixtureId: "f4", homeScore: 14, awayScore: 14 },
  ]);

  it("returns W/L/T for the last five final games with results", () => {
    expect(formLast5(fixtures, results, "t1")).toEqual(["W", "W", "T"]);
  });

  it("returns an empty array when there are no final games", () => {
    expect(formLast5(fixtures, new Map(), "t9")).toEqual([]);
  });
});

describe("winPercentage", () => {
  it("formats win pct with one decimal", () => {
    expect(winPercentage(3, 1, 0)).toBe("75.0");
    expect(winPercentage(1, 1, 1)).toBe("50.0");
  });

  it("returns em dash when no games played", () => {
    expect(winPercentage(0, 0, 0)).toBe("—");
  });
});

describe("mergeStandingsWithTeams", () => {
  it("appends teams missing from standings and sorts by rank", () => {
    const merged = mergeStandingsWithTeams(
      [standing("t2", "Bravo", 1, 2, 0), standing("t1", "Alpha", 2, 1, 1)],
      [
        { id: "t1", name: "Alpha", divisionId: "d1" },
        { id: "t2", name: "Bravo", divisionId: "d1" },
        { id: "t3", name: "Charlie", divisionId: "d2" },
      ],
    );
    expect(merged.map((row) => row.teamId)).toEqual(["t2", "t1", "t3"]);
    expect(merged.find((row) => row.teamId === "t3")?.wins).toBe(0);
  });
});

describe("pickKeyPlayers", () => {
  it("returns top four players by rating", () => {
    const players = [
      { id: "p1", name: "Alice", position: "QB" },
      { id: "p2", name: "Bob", position: "RB" },
      { id: "p3", name: "Cara", position: "WR" },
      { id: "p4", name: "Dan", position: "TE" },
      { id: "p5", name: "Eve", position: "LB" },
    ];
    const snapshots = new Map([
      ["p1", { weightedOverall: 88 }],
      ["p2", { weightedOverall: 92 }],
      ["p3", { weightedOverall: 81 }],
      ["p4", { weightedOverall: 95 }],
      ["p5", { weightedOverall: 77 }],
    ]);
    const key = pickKeyPlayers(players, snapshots, new Map());
    expect(key.map((player) => player.id)).toEqual(["p4", "p2", "p1", "p3"]);
  });
});

describe("computeTeamOvr", () => {
  it("averages SPRT ratings when present", () => {
    const snapshots = new Map([
      ["p1", { weightedOverall: 80 }],
      ["p2", { weightedOverall: 90 }],
    ]);
    expect(computeTeamOvr(snapshots, new Map())).toBe(85);
  });
});
