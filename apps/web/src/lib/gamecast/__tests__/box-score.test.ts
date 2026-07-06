import { describe, it, expect } from "vitest";
import { simulateGameLog, allPlays } from "@/lib/pbp";
import type {
  PbpGameInput,
  PbpPlay,
  PbpPlayType,
  TeamSimProfile,
  PlayerSimProfile,
} from "@/lib/pbp";
import { boxScoreAtPosition, scoreAtPosition } from "@/lib/gamecast";

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

const SCRIMMAGE_TYPES = new Set<PbpPlayType>([
  "rush",
  "pass_complete",
  "pass_incomplete",
  "sack",
  "interception",
  "kneel",
]);

function expectedTeamTotals(
  log: ReturnType<typeof simulateGameLog>,
  plays: PbpPlay[],
  playIndex: number,
  teamId: string,
) {
  let pass = 0;
  let rush = 0;
  let first = 0;
  let to = 0;
  let scrimmagePlays = 0;

  for (let i = 0; i < Math.min(playIndex, plays.length); i++) {
    const play = plays[i];
    if (play.offenseTeamId !== teamId) continue;

    if (play.playType === "pass_complete" || play.playType === "sack") {
      pass += play.yardsGained;
    } else if (play.playType === "rush" && !play.isTurnover) {
      rush += play.yardsGained;
    }

    if (play.isTurnover) to += 1;
    if (
      (play.playType === "rush" || play.playType === "pass_complete") &&
      play.yardsGained >= play.distance
    ) {
      first += 1;
    }
    if (isScrimmagePlay(play)) scrimmagePlays += 1;
  }

  return { pass, rush, total: pass + rush, first, to, plays: scrimmagePlays };
}

function isScrimmagePlay(play: PbpPlay): boolean {
  return SCRIMMAGE_TYPES.has(play.playType);
}

describe("gamecast box score", () => {
  const log = simulateGameLog(defaultInput(5150));
  const plays = allPlays(log);

  it("matches aggregate scrimmage totals over revealed plays", () => {
    const idx = Math.floor(plays.length / 3);
    const box = boxScoreAtPosition(log, plays, idx);

    const homeExpected = expectedTeamTotals(log, plays, idx, log.homeTeamId);
    const awayExpected = expectedTeamTotals(log, plays, idx, log.awayTeamId);

    expect(box.home.pass).toBe(homeExpected.pass);
    expect(box.home.rush).toBe(homeExpected.rush);
    expect(box.home.total).toBe(homeExpected.total);
    expect(box.home.first).toBe(homeExpected.first);
    expect(box.home.to).toBe(homeExpected.to);
    expect(box.home.plays).toBe(homeExpected.plays);

    expect(box.away.pass).toBe(awayExpected.pass);
    expect(box.away.rush).toBe(awayExpected.rush);
    expect(box.away.total).toBe(awayExpected.total);
  });

  it("uses scoreAtPosition for points", () => {
    for (const idx of [0, 1, Math.floor(plays.length / 2), plays.length]) {
      const box = boxScoreAtPosition(log, plays, idx);
      const score = scoreAtPosition(log, plays, idx);
      expect(box.home.pts).toBe(score.home);
      expect(box.away.pts).toBe(score.away);
    }
  });
});
