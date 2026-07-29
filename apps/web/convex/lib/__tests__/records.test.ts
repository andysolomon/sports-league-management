import { describe, expect, it } from "vitest";
import {
  mergeTopN,
  recordCandidatesFromSeason,
  type RecordCandidate,
} from "../records";

function candidate(
  category: string,
  value: number,
  key: string,
  overrides: Partial<RecordCandidate> = {},
): RecordCandidate {
  return {
    category,
    span: "season",
    value,
    seasonId: "season-1",
    teamId: "team-1",
    playerId: `player-${key}`,
    stableKey: key,
    ...overrides,
  };
}

describe("recordCandidatesFromSeason", () => {
  it("builds player and team candidates from F3/F2 rows", () => {
    const result = recordCandidatesFromSeason(
      [
        {
          seasonId: "s1",
          teamId: "t1",
          playerId: "p1",
          totalsJson: JSON.stringify({
            passing: { yards: 2200, td: 24 },
            defense: { tacklesSolo: 3, tacklesAst: 2 },
          }),
        },
      ],
      [
        {
          seasonId: "s1",
          teamId: "t1",
          wins: 9,
          pointsFor: 310,
          pointsAgainst: 210,
        },
      ],
    );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "passYards", value: 2200 }),
        expect.objectContaining({ category: "passTD", value: 24 }),
        expect.objectContaining({ category: "tackles", value: 5 }),
        expect.objectContaining({ category: "teamWins", value: 9 }),
        expect.objectContaining({ category: "teamPointsFor", value: 310 }),
        expect.objectContaining({
          category: "teamPointDifferential",
          value: 100,
        }),
      ]),
    );
  });
});

describe("mergeTopN", () => {
  it("caps every category at ten with contiguous unique ranks and descending values", () => {
    const candidates = [
      ...Array.from({ length: 18 }, (_, index) =>
        candidate("passYards", 100 - (index % 4), `pass-${index}`, {
          seasonId: `season-${index % 3}`,
          teamId: `team-${index % 5}`,
        }),
      ),
      ...Array.from({ length: 14 }, (_, index) =>
        candidate("rushYards", 50 - (index % 3), `rush-${index}`, {
          seasonId: `season-${index % 4}`,
          teamId: `team-${index % 2}`,
        }),
      ),
    ];

    const { entries } = mergeTopN([], candidates, 10);
    for (const category of ["passYards", "rushYards"]) {
      const rows = entries.filter((entry) => entry.category === category);
      expect(rows.length).toBeLessThanOrEqual(10);
      expect(rows.map((entry) => entry.rank)).toEqual(
        Array.from({ length: rows.length }, (_, index) => index + 1),
      );
      expect(new Set(rows.map((entry) => entry.rank)).size).toBe(rows.length);
      for (let index = 1; index < rows.length; index++) {
        expect(rows[index - 1]!.value).toBeGreaterThanOrEqual(
          rows[index]!.value,
        );
      }
    }
  });

  it("uses a deterministic terminal key for ties and reports no break on retry", () => {
    const tied = [
      candidate("passYards", 100, "z", { playerId: "same" }),
      candidate("passYards", 100, "a", { playerId: "same" }),
      candidate("passYards", 100, "m", { playerId: "same" }),
    ];
    const first = mergeTopN([], tied, 10);
    expect(first.entries.map((entry) => entry.stableKey)).toEqual([
      "a",
      "m",
      "z",
    ]);
    expect(first.broken).toHaveLength(3);

    const retried = mergeTopN(first.entries, tied, 10);
    expect(retried.entries).toEqual(first.entries);
    expect(retried.broken).toEqual([]);
  });
});
