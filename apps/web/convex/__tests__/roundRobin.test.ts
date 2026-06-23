import { describe, it, expect } from "vitest";
import {
  roundRobinSchedule,
  doubleRoundRobinSchedule,
  weekKickoff,
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

describe("doubleRoundRobinSchedule (WSM-000162)", () => {
  it("inherits the input guards from the single round-robin", () => {
    expect(() => doubleRoundRobinSchedule([])).toThrow(
      "need_at_least_two_teams",
    );
    expect(() => doubleRoundRobinSchedule(["t1", "t1"])).toThrow(
      "duplicate_team_ids",
    );
  });

  it("schedules two teams as a home-and-away pair across two weeks", () => {
    const p = doubleRoundRobinSchedule(ids(2));
    expect(p).toHaveLength(2);
    expect(p[0].week).toBe(1);
    expect(p[1].week).toBe(2);
    // Same matchup, home/away swapped.
    expect(p[1].homeTeamId).toBe(p[0].awayTeamId);
    expect(p[1].awayTeamId).toBe(p[0].homeTeamId);
  });

  it.each([2, 4, 6, 8])(
    "with %i teams: every pair meets exactly twice — once home each (N(N-1) games)",
    (n) => {
      const pairings = doubleRoundRobinSchedule(ids(n));
      const expectedGames = n * (n - 1);
      expect(pairings).toHaveLength(expectedGames);

      // No duplicate ordered (home, away) directed fixtures: each appears once.
      const directed = pairings.map((p) => `${p.homeTeamId}>${p.awayTeamId}`);
      expect(new Set(directed).size).toBe(expectedGames);

      // Every unordered pair meets exactly twice.
      const meetings = new Map<string, number>();
      for (const p of pairings) {
        const key = matchupKey(p);
        meetings.set(key, (meetings.get(key) ?? 0) + 1);
      }
      for (const count of meetings.values()) {
        expect(count).toBe(2);
      }

      // Each pair plays once with each team home (both directed fixtures exist).
      const teams = ids(n);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          expect(directed).toContain(`${teams[i]}>${teams[j]}`);
          expect(directed).toContain(`${teams[j]}>${teams[i]}`);
        }
      }
    },
  );

  it.each([
    [2, 2],
    [4, 6],
    [6, 10],
    [8, 14],
  ])("even count (%i teams) spans 2(N-1) weeks", (n, weeks) => {
    const pairings = doubleRoundRobinSchedule(ids(n));
    const maxWeek = Math.max(...pairings.map((p) => p.week));
    expect(maxWeek).toBe(weeks);
  });

  it("continues second-leg weeks after the first leg (no overlap)", () => {
    const n = 4;
    const single = roundRobinSchedule(ids(n));
    const firstLegMaxWeek = Math.max(...single.map((p) => p.week));
    const pairings = doubleRoundRobinSchedule(ids(n));

    // First leg occupies weeks 1..firstLegMaxWeek; second leg the next block.
    const minSecondLegWeek = Math.min(
      ...pairings
        .filter((p) => p.week > firstLegMaxWeek)
        .map((p) => p.week),
    );
    expect(minSecondLegWeek).toBe(firstLegMaxWeek + 1);
  });

  it("never schedules a team twice in the same week", () => {
    const pairings = doubleRoundRobinSchedule(ids(6));
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
});

describe("weekKickoff (WSM-000158)", () => {
  it("returns null when the season has no start date", () => {
    expect(weekKickoff(null, 1)).toBeNull();
    expect(weekKickoff("", 3)).toBeNull();
  });

  it("returns null for an unparseable start date", () => {
    expect(weekKickoff("not-a-date", 1)).toBeNull();
  });

  it("anchors a date-only start at noon UTC and adds 7 days per week (WSM-000160)", () => {
    // Noon UTC, not midnight, so the date renders correctly in the Americas.
    expect(weekKickoff("2026-09-01", 1)).toBe("2026-09-01T12:00:00.000Z");
    expect(weekKickoff("2026-09-01", 2)).toBe("2026-09-08T12:00:00.000Z");
    expect(weekKickoff("2026-09-01", 3)).toBe("2026-09-15T12:00:00.000Z");
  });

  it("renders the intended calendar day in a US-Eastern timezone", () => {
    // The bug: midnight UTC showed as the previous day. Noon UTC fixes it.
    const iso = weekKickoff("2026-09-05", 1)!;
    const shown = new Date(iso).toLocaleDateString("en-US", {
      timeZone: "America/New_York",
    });
    expect(shown).toBe("9/5/2026");
  });

  it("adds whole weeks without DST drift across a US fall-back", () => {
    // US DST ends 2026-11-01; whole-week UTC math keeps the same wall offset.
    const w1 = weekKickoff("2026-10-25", 1);
    const w2 = weekKickoff("2026-10-25", 2);
    expect(w1).toBe("2026-10-25T12:00:00.000Z");
    expect(w2).toBe("2026-11-01T12:00:00.000Z");
    expect(Date.parse(w2!) - Date.parse(w1!)).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("preserves the time-of-day when the start is a full ISO timestamp", () => {
    expect(weekKickoff("2026-09-01T19:30:00.000Z", 2)).toBe(
      "2026-09-08T19:30:00.000Z",
    );
  });
});
