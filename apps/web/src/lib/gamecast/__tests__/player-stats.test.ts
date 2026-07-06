import { describe, it, expect } from "vitest";
import {
  deriveStatLines,
  simulateGameLog,
  allPlays,
  type PbpGameInput,
  type PlayerSimProfile,
  type TeamSimProfile,
} from "@/lib/pbp";
import {
  leadersByCategory,
  normalizeStatLines,
  playerStatsAtPosition,
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

describe("gamecast player stats", () => {
  const log = simulateGameLog(defaultInput(5150));
  const plays = allPlays(log);

  it("accumulates only revealed plays", () => {
    const idx = Math.floor(plays.length / 3);
    const partial = playerStatsAtPosition(log, plays, idx);
    const full = playerStatsAtPosition(log, plays, plays.length);
    expect(partial.length).toBeLessThanOrEqual(full.length);
    expect(partial.length).toBeGreaterThan(0);
  });

  it("matches deriveStatLines at full game (order-insensitive)", () => {
    const atEnd = normalizeStatLines(
      playerStatsAtPosition(log, plays, plays.length),
    );
    const derived = normalizeStatLines(deriveStatLines(log));
    expect(atEnd).toEqual(derived);
  });

  it("returns empty lines at kickoff", () => {
    expect(playerStatsAtPosition(log, plays, 0)).toEqual([]);
  });

  it("leadersByCategory omits groups with no activity at kickoff", () => {
    const leaders = leadersByCategory([], log.homeTeamId, log.awayTeamId);
    expect(leaders).toEqual([]);
  });

  it("leadersByCategory returns per-team leaders for active groups", () => {
    const lines = playerStatsAtPosition(log, plays, plays.length);
    const leaders = leadersByCategory(lines, log.homeTeamId, log.awayTeamId);
    expect(leaders.length).toBeGreaterThan(0);

    for (const group of leaders) {
      if (group.home) {
        expect(group.home.teamId).toBe(log.homeTeamId);
        expect(group.home.compactLine.length).toBeGreaterThan(0);
      }
      if (group.away) {
        expect(group.away.teamId).toBe(log.awayTeamId);
        expect(group.away.compactLine.length).toBeGreaterThan(0);
      }
    }

    const passing = leaders.find((g) => g.group === "passing");
    expect(passing).toBeDefined();
    expect(passing!.home?.primaryValue).toBeGreaterThanOrEqual(0);
  });

  it("breaks ties by playerId for passing yards", () => {
    const homeId = log.homeTeamId;
    const tiedLines = [
      {
        playerId: "z-player",
        teamId: homeId,
        statLine: { passing: { comp: 5, att: 8, yards: 100, td: 0, int: 0, sacked: 0 } },
      },
      {
        playerId: "a-player",
        teamId: homeId,
        statLine: { passing: { comp: 5, att: 8, yards: 100, td: 0, int: 0, sacked: 0 } },
      },
    ];
    const leaders = leadersByCategory(tiedLines, homeId, "away");
    const passing = leaders.find((g) => g.group === "passing");
    expect(passing?.home?.playerId).toBe("a-player");
  });
});
