import { describe, it, expect } from "vitest";
import {
  categoryValues,
  computeStatLeaders,
  LEADER_CATEGORIES,
  type LeaderInput,
} from "../lib/statLeaders";

describe("categoryValues", () => {
  it("extracts per-category scalars from an aggregated stat line", () => {
    const totals = {
      passing: { yards: 2400, td: 22 },
      rushing: { yards: 800, td: 9 },
      receiving: { yards: 1100, rec: 64 },
      defense: { tacklesSolo: 40, tacklesAst: 18, sacks: 7, int: 3 },
    };
    expect(categoryValues(totals)).toEqual({
      passYards: 2400,
      passTD: 22,
      rushYards: 800,
      rushTD: 9,
      recYards: 1100,
      receptions: 64,
      tackles: 58, // solo + assisted
      sacks: 7,
      interceptions: 3,
    });
  });

  it("treats missing groups/fields as zero", () => {
    expect(categoryValues({})).toEqual({
      passYards: 0,
      passTD: 0,
      rushYards: 0,
      rushTD: 0,
      recYards: 0,
      receptions: 0,
      tackles: 0,
      sacks: 0,
      interceptions: 0,
    });
  });
});

describe("computeStatLeaders", () => {
  const players: LeaderInput[] = [
    {
      playerId: "p1",
      playerName: "Alpha QB",
      teamName: "Hawks",
      jerseyNumber: 7,
      values: { passYards: 3000, rushYards: 0 },
    },
    {
      playerId: "p2",
      playerName: "Bravo QB",
      teamName: "Eagles",
      jerseyNumber: 12,
      values: { passYards: 3000, rushYards: 500 },
    },
    {
      playerId: "p3",
      playerName: "Charlie RB",
      teamName: "Hawks",
      jerseyNumber: 22,
      values: { passYards: 0, rushYards: 1500 },
    },
  ];

  it("returns every category, ranked desc with name tiebreak, zeros excluded", () => {
    const board = computeStatLeaders(players, 5);
    expect(board).toHaveLength(LEADER_CATEGORIES.length);

    const passing = board.find((c) => c.key === "passYards")!;
    // Both QBs at 3000 — tiebreak by name (Alpha before Bravo). RB excluded (0).
    expect(passing.leaders.map((l) => l.playerId)).toEqual(["p1", "p2"]);

    const rushing = board.find((c) => c.key === "rushYards")!;
    expect(rushing.leaders.map((l) => l.playerId)).toEqual(["p3", "p2"]);
    expect(rushing.leaders[0].value).toBe(1500);

    // A category with no data is present but empty.
    const sacks = board.find((c) => c.key === "sacks")!;
    expect(sacks.leaders).toEqual([]);
  });

  it("caps each category at topN", () => {
    const many: LeaderInput[] = Array.from({ length: 10 }, (_, i) => ({
      playerId: `p${i}`,
      playerName: `Player ${i}`,
      teamName: "T",
      jerseyNumber: i,
      values: { sacks: 10 - i },
    }));
    const board = computeStatLeaders(many, 3);
    expect(board.find((c) => c.key === "sacks")!.leaders).toHaveLength(3);
  });
});
