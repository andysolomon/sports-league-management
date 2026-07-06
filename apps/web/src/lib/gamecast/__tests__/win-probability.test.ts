import { describe, it, expect } from "vitest";
import { simulateGameLog, allPlays } from "@/lib/pbp";
import type { PbpGameInput, TeamSimProfile, PlayerSimProfile } from "@/lib/pbp";
import {
  winProbabilityAtPosition,
  winProbabilitySeries,
  scoreAtPosition,
} from "@/lib/gamecast";

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

describe("gamecast win probability", () => {
  const log = simulateGameLog(defaultInput(1337));
  const plays = allPlays(log);

  it("starts at 50% before kickoff", () => {
    expect(winProbabilityAtPosition(log, plays, 0)).toBe(50);
  });

  it("returns bounded probabilities for in-game reveal indices", () => {
    for (let i = 1; i < plays.length; i++) {
      const p = winProbabilityAtPosition(log, plays, i);
      expect(p).toBeGreaterThanOrEqual(2);
      expect(p).toBeLessThanOrEqual(98);
    }
  });

  it("builds a series with pre-kickoff 50 and length plays+1", () => {
    const series = winProbabilitySeries(log, plays);
    expect(series[0]).toBe(50);
    expect(series).toHaveLength(plays.length + 1);
    expect(series[series.length - 1]).toBe(winProbabilityAtPosition(log, plays, plays.length));
  });

  it("ends at 99, 1, or 50 based on final margin", () => {
    const final = winProbabilityAtPosition(log, plays, plays.length);
    const { home, away } = scoreAtPosition(log, plays, plays.length);
    if (home > away) expect(final).toBe(99);
    else if (home < away) expect(final).toBe(1);
    else expect(final).toBe(50);
  });
});
