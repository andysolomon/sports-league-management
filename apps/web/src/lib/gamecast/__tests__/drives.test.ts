import { describe, it, expect } from "vitest";
import { simulateGameLog, allPlays } from "@/lib/pbp";
import type { PbpGameInput, TeamSimProfile, PlayerSimProfile } from "@/lib/pbp";
import {
  buildDriveChartSegments,
  groupPlaysByDrive,
  offenseToChartYard,
  driveResultToken,
  driveResultLabel,
  revealedPlays,
} from "@/lib/gamecast";
import { nextPlayIndex } from "../reveal";

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

describe("gamecast drive selectors", () => {
  const log = simulateGameLog(defaultInput(4242));
  const plays = allPlays(log);

  it("maps offense yard lines onto a home-left chart", () => {
    expect(offenseToChartYard(25, log.homeTeamId, log.homeTeamId)).toBe(25);
    expect(offenseToChartYard(25, log.awayTeamId, log.homeTeamId)).toBe(75);
  });

  it("builds chart segments for every drive", () => {
    const segments = buildDriveChartSegments(log, plays, 0);
    expect(segments).toHaveLength(log.drives.length);
    expect(segments.every((s) => s.startChart >= 0 && s.startChart <= 100)).toBe(
      true,
    );
  });

  it("marks the current drive from the reveal index", () => {
    const mid = Math.floor(plays.length / 2);
    const segments = buildDriveChartSegments(log, plays, mid);
    const current = segments.filter((s) => s.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].driveId).toBe(plays[mid - 1].driveId);
  });

  it("groups revealed plays by drive in order", () => {
    const idx = nextPlayIndex(nextPlayIndex(0, plays.length), plays.length);
    const groups = groupPlaysByDrive(
      log,
      revealedPlays(plays, idx),
    );
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].plays.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.plays.every((p) => p.driveId === g.driveId)).toBe(true);
    }
  });

  it("maps drive end reasons to semantic tokens and labels", () => {
    expect(driveResultToken("touchdown")).toBe("accent");
    expect(driveResultToken("turnover")).toBe("danger");
    expect(driveResultLabel("punt")).toBe("Punt");
  });
});
