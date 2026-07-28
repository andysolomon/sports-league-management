import { describe, it, expect } from "vitest";
import { simulateGameLog } from "@/lib/pbp/engine";
import { deriveWeather } from "@/lib/pbp/weather";
import { scoreAtPosition } from "@/lib/gamecast/reveal";
import type {
  PbpPlay,
  PlayerSimProfile,
  TeamSimProfile,
} from "@/lib/pbp/types";

/*
 * The Gamecast scoreboard must agree with the official score.
 *
 * `scoreAtPosition` recomputes the score by walking plays, while the recorded
 * result comes from `log.homeScore` / `log.awayScore`. Those are two
 * independent paths to the same number, and a league sees BOTH — the schedule
 * shows the recorded result and the Gamecast shows the walk. When they
 * disagree, one of them is lying about a game that was actually played.
 *
 * Both failures this pins were invisible until the Epic A gates were switched
 * on, because neither mechanic could occur with them off:
 *
 *  - a touchdown wiped out by holding stayed in the log (deliberately) and was
 *    still counted, inflating the offense;
 *  - a safety or pick-six scores for the DEFENSE via `defensivePoints`, and
 *    was dropped entirely, shorting the scoring team.
 */

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function roster(teamId: string, strength: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
    ["QB", 2], ["RB", 3], ["WR", 5], ["TE", 2], ["DE", 2], ["DT", 2],
    ["OLB", 2], ["MLB", 2], ["CB", 3], ["S", 2], ["K", 1], ["P", 1],
  ];
  const out: PlayerSimProfile[] = [];
  for (const [pos, count] of specs) {
    for (let i = 1; i <= count; i++) {
      const jitter = ((i * 7 + strength) % 11) - 5;
      out.push({
        playerId: `${teamId}-${pos}-${i}`,
        position: pos,
        overall: clamp(strength + jitter, 40, 99),
        depthRank: i,
        positionSlot: pos,
      });
    }
  }
  return out;
}

const team = (teamId: string, strength: number): TeamSimProfile => ({
  teamId,
  strength,
  players: roster(teamId, strength),
});

const PRODUCTION_GATES = {
  scoringV2: true,
  penalties: true,
  situational: true,
  balance: true,
  weather: true,
} as const;

function play(seed: number, gated: boolean) {
  return simulateGameLog({
    home: team("home", 70),
    away: team("away", 70),
    seed,
    flavor: "balanced",
    ...(gated
      ? {
          features: PRODUCTION_GATES,
          weather: deriveWeather({
            seasonId: "parity",
            week: (seed % 14) + 1,
            venueId: `venue_${seed % 24}`,
          }),
        }
      : {}),
  });
}

function walked(log: ReturnType<typeof simulateGameLog>) {
  const plays = log.drives.flatMap((drive) => drive.plays);
  return scoreAtPosition(log, plays, plays.length);
}

/** First seed in the sweep whose game contains a play matching `predicate`. */
function findPlay(predicate: (p: PbpPlay) => boolean) {
  for (let seed = 5000; seed < 5400; seed++) {
    const log = play(seed, true);
    const plays = log.drives.flatMap((d) => d.plays);
    const match = plays.find(predicate);
    if (match) return { log, plays, play: match };
  }
  return null;
}

describe("Gamecast scoreboard parity with the recorded result", () => {
  it("agrees on every game under production gates", () => {
    // 400 seeds because the two failure modes need a penalty-negated score and
    // a defensive score to occur — at 300 seeds roughly a fifth of games hit
    // one, so a handful of seeds would not prove much.
    const mismatched: string[] = [];
    for (let seed = 5000; seed < 5400; seed++) {
      const log = play(seed, true);
      const score = walked(log);
      if (score.home !== log.homeScore || score.away !== log.awayScore) {
        mismatched.push(
          `seed ${seed}: recorded ${log.homeScore}-${log.awayScore}, gamecast ${score.home}-${score.away}`,
        );
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("agrees on every game with the gates off", () => {
    for (let seed = 5000; seed < 5100; seed++) {
      const log = play(seed, false);
      expect(walked(log)).toEqual({
        home: log.homeScore,
        away: log.awayScore,
      });
    }
  });

  it("scores a safety or pick-six for the defense, not the offense", () => {
    // Scan for a seed that produces one rather than hardcoding: the game a
    // seed produces depends on the weather parameters too, so a pinned seed
    // silently stops covering this the moment either changes.
    const found = findPlay((p) => Boolean(p.defensivePoints));
    expect(found).not.toBeNull();
    const { log, plays, play: defensiveScore } = found!;

    const upTo = plays.indexOf(defensiveScore) + 1;
    const before = scoreAtPosition(log, plays, upTo - 1);
    const after = scoreAtPosition(log, plays, upTo);
    const scoringSide =
      defensiveScore.defenseTeamId === log.homeTeamId ? "home" : "away";
    const conceding = scoringSide === "home" ? "away" : "home";

    expect(after[scoringSide] - before[scoringSide]).toBe(
      defensiveScore.defensivePoints,
    );
    expect(after[conceding]).toBe(before[conceding]);
  });

  it("gives no points for a score a penalty wiped out", () => {
    const found = findPlay(
      (p) => p.isScoring && p.penalty?.negatesPlay === true,
    );
    expect(found).not.toBeNull();
    const { log, plays, play: negated } = found!;

    const upTo = plays.indexOf(negated) + 1;
    expect(scoreAtPosition(log, plays, upTo)).toEqual(
      scoreAtPosition(log, plays, upTo - 1),
    );
  });
});
