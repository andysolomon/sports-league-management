import { describe, it, expect } from "vitest";
import {
  roundRobinSchedule,
  type RoundRobinPairing,
} from "../lib/roundRobin";

/** Unordered key for a pairing so home/away swaps compare equal. */
function matchupKey(p: RoundRobinPairing): string {
  return [p.homeTeamId, p.awayTeamId].sort().join("|");
}

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `t${i + 1}`);
}

describe("roundRobinSchedule (WSM-000153)", () => {
  it("rejects fewer than two teams", () => {
    expect(() => roundRobinSchedule([])).toThrow("need_at_least_two_teams");
    expect(() => roundRobinSchedule(["t1"])).toThrow("need_at_least_two_teams");
  });

  it("rejects duplicate team ids", () => {
    expect(() => roundRobinSchedule(["t1", "t1"])).toThrow("duplicate_team_ids");
  });

  it("schedules two teams as a single week, one game", () => {
    const p = roundRobinSchedule(ids(2));
    expect(p).toHaveLength(1);
    expect(p[0].week).toBe(1);
    expect(matchupKey(p[0])).toBe("t1|t2");
  });

  it.each([2, 3, 4, 5, 6, 8, 10])(
    "with %i teams: every pair meets exactly once (C(n,2) games)",
    (n) => {
      const pairings = roundRobinSchedule(ids(n));
      const expectedGames = (n * (n - 1)) / 2;
      expect(pairings).toHaveLength(expectedGames);

      const keys = pairings.map(matchupKey);
      // No duplicate matchups.
      expect(new Set(keys).size).toBe(expectedGames);
      // Every possible pair is present.
      const teams = ids(n);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          expect(keys).toContain([teams[i], teams[j]].sort().join("|"));
        }
      }
    },
  );

  it.each([
    [4, 3],
    [6, 5],
    [8, 7],
  ])("even count (%i teams) spans n-1 weeks", (n, weeks) => {
    const pairings = roundRobinSchedule(ids(n));
    const maxWeek = Math.max(...pairings.map((p) => p.week));
    expect(maxWeek).toBe(weeks);
  });

  it.each([
    [3, 3],
    [5, 5],
    [7, 7],
  ])("odd count (%i teams) spans n weeks with one team resting each", (n, weeks) => {
    const pairings = roundRobinSchedule(ids(n));
    const maxWeek = Math.max(...pairings.map((p) => p.week));
    expect(maxWeek).toBe(weeks);
  });

  it("never schedules a team twice in the same week", () => {
    const pairings = roundRobinSchedule(ids(6));
    const byWeek = new Map<number, string[]>();
    for (const p of pairings) {
      const arr = byWeek.get(p.week) ?? [];
      arr.push(p.homeTeamId, p.awayTeamId);
      byWeek.set(p.week, arr);
    }
    for (const teams of byWeek.values()) {
      expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it("never pairs a team against itself", () => {
    for (const p of roundRobinSchedule(ids(7))) {
      expect(p.homeTeamId).not.toBe(p.awayTeamId);
    }
  });

  it.each([
    [4, 1],
    [6, 1],
    [8, 1],
    [10, 1],
    [5, 2],
    [7, 2],
    [9, 2],
  ])(
    "balances home/away load for %i teams (max diff %i)",
    (n, maxDiff) => {
      const homeCount = new Map<string, number>();
      const awayCount = new Map<string, number>();
      for (const p of roundRobinSchedule(ids(n))) {
        homeCount.set(p.homeTeamId, (homeCount.get(p.homeTeamId) ?? 0) + 1);
        awayCount.set(p.awayTeamId, (awayCount.get(p.awayTeamId) ?? 0) + 1);
      }
      // Even counts alternate perfectly (diff <= 1); odd counts carry a bye
      // each week that unavoidably pushes the worst team to diff <= 2.
      for (const team of ids(n)) {
        const home = homeCount.get(team) ?? 0;
        const away = awayCount.get(team) ?? 0;
        expect(Math.abs(home - away)).toBeLessThanOrEqual(maxDiff);
      }
    },
  );
});
