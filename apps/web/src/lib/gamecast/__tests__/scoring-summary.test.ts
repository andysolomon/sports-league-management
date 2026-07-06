import { describe, it, expect } from "vitest";
import { simulateGameLog, allPlays } from "@/lib/pbp";
import type { PbpGameInput, TeamSimProfile, PlayerSimProfile } from "@/lib/pbp";
import { scoringSummaryAtPosition } from "@/lib/gamecast";

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

describe("gamecast scoring summary", () => {
  const log = simulateGameLog(defaultInput(8080));
  const plays = allPlays(log);

  it("lists only touchdowns and field goals in reveal order", () => {
    const summary = scoringSummaryAtPosition(log, plays, plays.length);

    for (const entry of summary) {
      expect(["touchdown", "field_goal"]).toContain(entry.kind);
      expect(entry.points).toBeGreaterThan(0);
      expect(entry.team).toMatch(/^(home|away)$/);
    }

    let home = 0;
    let away = 0;
    for (let i = 0; i < plays.length; i++) {
      const play = plays[i];
      if (!play.isScoring) continue;
      if (play.playType === "extra_point" || play.playType === "extra_point_miss") {
        continue;
      }
      const kind =
        play.playType === "field_goal"
          ? "field_goal"
          : play.pointsScored === 6
            ? "touchdown"
            : null;
      if (!kind) continue;

      // A made extra point folds into its touchdown row.
      let points = play.pointsScored;
      const next = plays[i + 1];
      if (kind === "touchdown" && next?.playType === "extra_point" && next.isScoring) {
        points += next.pointsScored;
      }

      if (play.offenseTeamId === log.homeTeamId) home += points;
      else away += points;

      const entry = summary.find(
        (e) =>
          e.quarter === play.quarter &&
          e.clockSeconds === play.clockSeconds &&
          e.kind === kind &&
          e.points === points,
      );
      expect(entry).toBeDefined();
      expect(entry?.homeScore).toBe(home);
      expect(entry?.awayScore).toBe(away);
    }
  });

  it("running score of the last entry matches the full-game score", () => {
    const summary = scoringSummaryAtPosition(log, plays, plays.length);
    const last = summary[summary.length - 1];
    expect(last).toBeDefined();
    expect(last.homeScore).toBe(log.homeScore);
    expect(last.awayScore).toBe(log.awayScore);
  });

  it("excludes extra points from the summary", () => {
    const summary = scoringSummaryAtPosition(log, plays, plays.length);
    const xpPlays = plays.filter(
      (p) => p.playType === "extra_point" || p.playType === "extra_point_miss",
    );
    for (const xp of xpPlays) {
      expect(
        summary.some(
          (e) =>
            e.quarter === xp.quarter &&
            e.clockSeconds === xp.clockSeconds &&
            e.points === xp.pointsScored,
        ),
      ).toBe(false);
    }
  });
});
