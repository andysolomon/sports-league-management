import { describe, expect, it } from "vitest";
import {
  computePowerRankings,
  MAX_WEEKLY_RANK_MOVEMENT,
  type PowerRankingRecord,
} from "@/lib/history/power-rankings";

function record(
  teamId: string,
  patch: Partial<PowerRankingRecord> = {},
): PowerRankingRecord {
  return {
    teamId,
    wins: 4,
    losses: 4,
    ties: 0,
    pointsFor: 160,
    pointsAgainst: 160,
    headToHeadJson: "{}",
    lastResults: ["W", "L", "W", "L"],
    gamesCounted: 8,
    ...patch,
  };
}

describe("computePowerRankings", () => {
  it("limits a single blowout to the weekly damping constant", () => {
    const records = Array.from({ length: 8 }, (_, index) =>
      record(`team_${index + 1}`),
    );
    const previous = records.map((team, index) => ({
      teamId: team.teamId,
      rank: index + 1,
    }));
    const afterBlowout = records.map((team) =>
      team.teamId === "team_8"
        ? record(team.teamId, {
            wins: 5,
            losses: 4,
            pointsFor: 240,
            pointsAgainst: 160,
            lastResults: ["W", "W", "L", "W", "L"],
            gamesCounted: 9,
          })
        : team,
    );

    const poll = computePowerRankings(afterBlowout, previous);
    const formerLast = poll.find((team) => team.teamId === "team_8")!;

    expect(8 - formerLast.rank).toBeGreaterThan(0);
    expect(8 - formerLast.rank).toBeLessThanOrEqual(
      MAX_WEEKLY_RANK_MOVEMENT,
    );
  });

  it("property: random result sets always produce a complete rank permutation", () => {
    let state = 0x632d3;
    const randomInt = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % max;
    };

    for (let sample = 0; sample < 100; sample += 1) {
      const teamCount = 2 + randomInt(19);
      const records = Array.from({ length: teamCount }, (_, index) => {
        const games = 1 + randomInt(12);
        const wins = randomInt(games + 1);
        const ties = randomInt(games - wins + 1);
        const losses = games - wins - ties;
        const results = Array.from({ length: Math.min(10, games) }, () =>
          ["W", "L", "T"][randomInt(3)]!,
        );
        return record(`sample_${sample}_team_${index}`, {
          wins,
          losses,
          ties,
          pointsFor: randomInt(games * 50 + 1),
          pointsAgainst: randomInt(games * 50 + 1),
          lastResults: results,
          gamesCounted: games,
        });
      });

      const weekOne = computePowerRankings(records);
      expect(weekOne.map((row) => row.rank).sort((a, b) => a - b)).toEqual(
        Array.from({ length: teamCount }, (_, index) => index + 1),
      );
      expect(new Set(weekOne.map((row) => row.teamId))).toEqual(
        new Set(records.map((row) => row.teamId)),
      );
      expect(weekOne.every((row) => row.previousRank === null)).toBe(true);

      const nextRecords = records.map((row) => ({
        ...row,
        wins: row.wins + randomInt(2),
        losses: row.losses + randomInt(2),
        pointsFor: row.pointsFor + randomInt(50),
        pointsAgainst: row.pointsAgainst + randomInt(50),
        gamesCounted: row.gamesCounted + 1,
      }));
      const weekTwo = computePowerRankings(
        nextRecords,
        weekOne.map(({ teamId, rank }) => ({ teamId, rank })),
      );
      expect(weekTwo.map((row) => row.rank).sort((a, b) => a - b)).toEqual(
        Array.from({ length: teamCount }, (_, index) => index + 1),
      );
      expect(new Set(weekTwo.map((row) => row.teamId))).toEqual(
        new Set(records.map((row) => row.teamId)),
      );
    }
  });
});
