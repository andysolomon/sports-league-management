import { describe, it, expect } from "vitest";
import { simulateGameLog, allPlays } from "@/lib/pbp";
import type { PbpGameInput, TeamSimProfile, PlayerSimProfile } from "@/lib/pbp";
import {
  scoreAtPosition,
  clockAtPosition,
  nextPlayIndex,
  nextQuarterIndex,
  nextHalfIndex,
  entireGameIndex,
  restartIndex,
  revealedPlays,
  formatGameClock,
  formatQuarterLabel,
} from "../reveal";

function makePlayer(
  teamId: string,
  position: string,
  overall: number,
  depthRank: number,
): PlayerSimProfile {
  return {
    playerId: `${teamId}-${position}-${depthRank}`,
    position,
    overall,
    depthRank,
    positionSlot: position,
  };
}

function buildRoster(teamId: string, strength: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
    ["QB", 1],
    ["RB", 2],
    ["WR", 3],
    ["TE", 1],
    ["DE", 2],
    ["LB", 2],
    ["CB", 2],
    ["K", 1],
    ["P", 1],
  ];
  const players: PlayerSimProfile[] = [];
  for (const [pos, count] of specs) {
    for (let i = 1; i <= count; i++) {
      players.push(makePlayer(teamId, pos, strength, i));
    }
  }
  return players;
}

function buildTeam(teamId: string, strength: number): TeamSimProfile {
  return { teamId, strength, players: buildRoster(teamId, strength) };
}

function defaultInput(seed: number): PbpGameInput {
  return {
    home: buildTeam("home", 68),
    away: buildTeam("away", 62),
    seed,
    decisive: false,
  };
}

describe("gamecast reveal stepping", () => {
  const log = simulateGameLog(defaultInput(9001));
  const plays = allPlays(log);

  it("starts at zero plays revealed", () => {
    expect(restartIndex()).toBe(0);
    expect(revealedPlays(plays, 0)).toEqual([]);
    expect(clockAtPosition(plays, 0)).toBeNull();
    expect(scoreAtPosition(log, plays, 0)).toEqual({ home: 0, away: 0 });
  });

  it("next play advances one at a time through the full log", () => {
    let idx = 0;
    for (let step = 0; step < plays.length; step++) {
      idx = nextPlayIndex(idx, plays.length);
      expect(idx).toBe(step + 1);
    }
    expect(nextPlayIndex(idx, plays.length)).toBe(plays.length);
  });

  it("score at position matches scoring plays through the reveal index", () => {
    for (let i = 1; i <= plays.length; i += Math.max(1, Math.floor(plays.length / 12))) {
      const expected = scoreAtPosition(log, plays, plays.length);
      const at = scoreAtPosition(log, plays, i);
      let home = 0;
      let away = 0;
      for (let j = 0; j < i; j++) {
        const p = plays[j];
        if (!p.isScoring) continue;
        if (p.offenseTeamId === log.homeTeamId) home += p.pointsScored;
        else away += p.pointsScored;
      }
      expect(at).toEqual({ home, away });
      if (i === plays.length) expect(at).toEqual(expected);
    }
  });

  it("next quarter jumps to quarter boundaries", () => {
    const q1End = nextQuarterIndex(plays, 0);
    expect(q1End).toBeGreaterThan(0);
    expect(plays[q1End - 1].quarter).toBe(1);
    if (q1End < plays.length) expect(plays[q1End].quarter).toBeGreaterThan(1);

    const q2End = nextQuarterIndex(plays, q1End);
    expect(q2End).toBeGreaterThanOrEqual(q1End);
  });

  it("next half jumps to half boundaries", () => {
    const half1End = nextHalfIndex(plays, 0);
    expect(half1End).toBeGreaterThan(0);
    expect(plays[half1End - 1].quarter).toBeLessThanOrEqual(2);

    const half2End = nextHalfIndex(plays, half1End);
    expect(half2End).toBeGreaterThanOrEqual(half1End);
    if (half2End < plays.length) {
      expect(plays[half2End - 1].quarter).toBeLessThanOrEqual(4);
    }
  });

  it("entire game reveals all plays", () => {
    expect(entireGameIndex(plays.length)).toBe(plays.length);
    expect(revealedPlays(plays, plays.length)).toHaveLength(plays.length);
  });

  it("formats clock and quarter labels", () => {
    expect(formatGameClock(125)).toBe("2:05");
    expect(formatGameClock(7)).toBe("0:07");
    expect(formatQuarterLabel(3)).toBe("Q3");
    expect(formatQuarterLabel(5)).toBe("OT1");
  });
});
