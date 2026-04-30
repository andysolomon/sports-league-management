import { describe, it, expect } from "vitest";
import {
  computeStandingsPure,
  type FixtureLike,
  type ResultLike,
  type TeamLike,
} from "../../../convex/lib/standings";

const teams: TeamLike[] = [
  { _id: "t_a", name: "Alpha", divisionId: "d_north" },
  { _id: "t_b", name: "Bravo", divisionId: "d_north" },
  { _id: "t_c", name: "Charlie", divisionId: "d_south" },
  { _id: "t_d", name: "Delta", divisionId: "d_south" },
];

function fixture(
  id: string,
  home: string,
  away: string,
  status = "final",
): FixtureLike {
  return {
    _id: id,
    seasonId: "s1",
    homeTeamId: home,
    awayTeamId: away,
    status,
  };
}

function result(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
): ResultLike {
  return { fixtureId, homeScore, awayScore };
}

describe("computeStandingsPure", () => {
  it("returns zeroed rows when no results have been recorded", () => {
    const out = computeStandingsPure({
      teams,
      fixtures: [fixture("f1", "t_a", "t_b", "scheduled")],
      results: [],
    });
    expect(out).toHaveLength(4);
    for (const row of out) {
      expect(row.wins).toBe(0);
      expect(row.losses).toBe(0);
      expect(row.ties).toBe(0);
      expect(row.pointsFor).toBe(0);
      expect(row.pointsAgainst).toBe(0);
    }
  });

  it("ignores results whose parent fixture isn't final", () => {
    const out = computeStandingsPure({
      teams,
      fixtures: [fixture("f1", "t_a", "t_b", "scheduled")],
      results: [result("f1", 21, 7)],
    });
    const a = out.find((r) => r.teamId === "t_a")!;
    expect(a.wins).toBe(0);
    expect(a.pointsFor).toBe(0);
  });

  it("accumulates W/L/T + PF/PA from a single finalized fixture", () => {
    const out = computeStandingsPure({
      teams,
      fixtures: [fixture("f1", "t_a", "t_b")],
      results: [result("f1", 24, 10)],
    });
    const a = out.find((r) => r.teamId === "t_a")!;
    const b = out.find((r) => r.teamId === "t_b")!;
    expect(a.wins).toBe(1);
    expect(a.pointsFor).toBe(24);
    expect(a.pointsAgainst).toBe(10);
    expect(b.losses).toBe(1);
    expect(b.pointsFor).toBe(10);
    expect(b.pointsAgainst).toBe(24);
  });

  it("counts a tie when scores are equal", () => {
    const out = computeStandingsPure({
      teams,
      fixtures: [fixture("f1", "t_a", "t_b")],
      results: [result("f1", 17, 17)],
    });
    const a = out.find((r) => r.teamId === "t_a")!;
    const b = out.find((r) => r.teamId === "t_b")!;
    expect(a.ties).toBe(1);
    expect(b.ties).toBe(1);
    expect(a.wins).toBe(0);
    expect(b.wins).toBe(0);
  });

  it("breaks ties by head-to-head when wins are equal", () => {
    // Both Alpha and Bravo go 1-0 against an out-of-division opponent,
    // then Alpha beats Bravo head-to-head → Alpha ranks above Bravo.
    const out = computeStandingsPure({
      teams,
      fixtures: [
        fixture("f1", "t_a", "t_c"),
        fixture("f2", "t_b", "t_d"),
        fixture("f3", "t_a", "t_b"),
      ],
      results: [
        result("f1", 21, 0),
        result("f2", 14, 7),
        result("f3", 10, 3),
      ],
    });

    const a = out.find((r) => r.teamId === "t_a")!;
    const b = out.find((r) => r.teamId === "t_b")!;
    expect(a.wins).toBe(2);
    expect(b.wins).toBe(1);
    expect(a.leagueRank).toBeLessThan(b.leagueRank);
  });

  it("falls through head-to-head → division record → points-differential", () => {
    // Alpha and Bravo never play each other; both 1-0 vs out-of-division
    // teams. Division records are equal. Alpha's PF-PA differential
    // (+30) beats Bravo's (+5) → Alpha ranks higher.
    const out = computeStandingsPure({
      teams,
      fixtures: [
        fixture("f1", "t_a", "t_c"),
        fixture("f2", "t_b", "t_d"),
      ],
      results: [
        result("f1", 35, 5),
        result("f2", 10, 5),
      ],
    });
    const a = out.find((r) => r.teamId === "t_a")!;
    const b = out.find((r) => r.teamId === "t_b")!;
    expect(a.wins).toBe(1);
    expect(b.wins).toBe(1);
    expect(a.leagueRank).toBe(1);
    expect(b.leagueRank).toBe(2);
  });

  it("prefers the team with a better division record on a 2-way tie", () => {
    // Alpha: 1-0 vs in-division Bravo. Charlie: 1-0 vs out-of-division Delta.
    // Both end 1-0, no head-to-head between Alpha & Charlie. Alpha has
    // a 1-0 division record; Charlie has 0-0 → Alpha ranks higher.
    const out = computeStandingsPure({
      teams,
      fixtures: [
        fixture("f1", "t_a", "t_b"),
        fixture("f2", "t_c", "t_d"),
      ],
      results: [
        result("f1", 14, 7),
        result("f2", 14, 7),
      ],
    });
    const aRank = out.find((r) => r.teamId === "t_a")!.leagueRank;
    const cRank = out.find((r) => r.teamId === "t_c")!.leagueRank;
    expect(aRank).toBeLessThan(cRank);
  });

  it("assigns per-division ranks independently of league rank", () => {
    const out = computeStandingsPure({
      teams,
      fixtures: [
        fixture("f1", "t_a", "t_b"),
        fixture("f2", "t_c", "t_d"),
      ],
      results: [
        result("f1", 14, 7),
        result("f2", 21, 0),
      ],
    });

    const aDiv = out.find((r) => r.teamId === "t_a")!.divisionRank;
    const bDiv = out.find((r) => r.teamId === "t_b")!.divisionRank;
    const cDiv = out.find((r) => r.teamId === "t_c")!.divisionRank;
    const dDiv = out.find((r) => r.teamId === "t_d")!.divisionRank;

    expect(aDiv).toBe(1);
    expect(bDiv).toBe(2);
    expect(cDiv).toBe(1);
    expect(dDiv).toBe(2);
  });

  it("filters output rows by division when divisionFilter is set", () => {
    const out = computeStandingsPure({
      teams,
      fixtures: [fixture("f1", "t_a", "t_b")],
      results: [result("f1", 14, 7)],
      divisionFilter: "d_north",
    });
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.teamId === "t_a" || r.teamId === "t_b")).toBe(
      true,
    );
  });

  it("preserves stable league ordering across the whole set when filtered", () => {
    // Alpha goes 1-0; everyone else 0-0. Filter to north → Alpha rank 1, Bravo rank 2.
    const out = computeStandingsPure({
      teams,
      fixtures: [fixture("f1", "t_a", "t_b")],
      results: [result("f1", 28, 0)],
      divisionFilter: "d_north",
    });
    const aRow = out.find((r) => r.teamId === "t_a")!;
    const bRow = out.find((r) => r.teamId === "t_b")!;
    expect(aRow.leagueRank).toBe(1);
    expect(bRow.leagueRank).toBeGreaterThan(aRow.leagueRank);
  });
});
