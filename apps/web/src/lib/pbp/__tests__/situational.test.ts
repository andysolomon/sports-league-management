import { describe, it, expect } from "vitest";
import { simulateGameLog } from "../engine";
import {
  clockStrategy,
  fourthDownDecision,
  runoffSeconds,
  secondsLeftInGame,
  secondsLeftInHalf,
  shouldOnside,
  shouldSpike,
  shouldUseTimeout,
  type FourthDownInput,
} from "../situational";
import type {
  PbpFeatureGates,
  PbpGameInput,
  PbpPlay,
  PlayerSimProfile,
  TeamSimProfile,
} from "../types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildRoster(teamId: string, strength: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
    ["QB", 2],
    ["RB", 3],
    ["WR", 5],
    ["TE", 2],
    ["DE", 2],
    ["DT", 2],
    ["OLB", 2],
    ["MLB", 2],
    ["CB", 3],
    ["S", 2],
    ["K", 1],
    ["P", 1],
  ];
  const players: PlayerSimProfile[] = [];
  for (const [pos, count] of specs) {
    for (let i = 1; i <= count; i++) {
      const jitter = ((i * 7 + strength) % 11) - 5;
      players.push({
        playerId: `${teamId}-${pos}-${i}`,
        position: pos,
        overall: clamp(strength + jitter, 40, 99),
        depthRank: i,
        positionSlot: pos,
      });
    }
  }
  return players;
}

function buildTeam(
  teamId: string,
  strength: number,
  aggression?: number,
): TeamSimProfile {
  return {
    teamId,
    strength,
    players: buildRoster(teamId, strength),
    ...(aggression === undefined ? {} : { coach: { aggression } }),
  };
}

const SITUATIONAL: PbpFeatureGates = { situational: true };

function gameInput(overrides: Partial<PbpGameInput> = {}): PbpGameInput {
  return {
    home: buildTeam("home", 70),
    away: buildTeam("away", 70),
    seed: 4242,
    flavor: "balanced",
    ...overrides,
  };
}

function allPlays(log: ReturnType<typeof simulateGameLog>): PbpPlay[] {
  return log.drives.flatMap((d) => d.plays);
}

function simulateMany(
  count: number,
  features: PbpFeatureGates | undefined,
  seedBase = 7000,
  overrides: Partial<PbpGameInput> = {},
): PbpPlay[] {
  const out: PbpPlay[] = [];
  for (let i = 0; i < count; i++) {
    out.push(
      ...allPlays(
        simulateGameLog({
          ...gameInput({ seed: seedBase + i, ...overrides }),
          features,
        }),
      ),
    );
  }
  return out;
}

function fourthDown(overrides: Partial<FourthDownInput> = {}): FourthDownInput {
  return {
    yardsToGo: 5,
    yardsToGoal: 55,
    scoreDiff: 0,
    quarter: 2,
    clockSeconds: 400,
    isOvertime: false,
    aggression: 50,
    ...overrides,
  };
}

describe("clock arithmetic", () => {
  it("counts remaining regulation across quarters", () => {
    expect(secondsLeftInGame(1, 720, false)).toBe(720 * 4);
    expect(secondsLeftInGame(4, 90, false)).toBe(90);
    // Overtime has no later quarter to defer to, so everything is urgent.
    expect(secondsLeftInGame(5, 300, true)).toBe(0);
  });

  it("counts to the end of the current half, not the game", () => {
    expect(secondsLeftInHalf(1, 720, false)).toBe(1440);
    expect(secondsLeftInHalf(2, 100, false)).toBe(100);
    // Q3 keys on the END of the game, which is the end of its half.
    expect(secondsLeftInHalf(3, 720, false)).toBe(1440);
    expect(secondsLeftInHalf(4, 100, false)).toBe(100);
  });
});

describe("fourthDownDecision", () => {
  it("punts on 4th and long from deep in its own end", () => {
    expect(fourthDownDecision(fourthDown({ yardsToGo: 9, yardsToGoal: 80 }))).toBe(
      "punt",
    );
  });

  it("kicks from field goal range on 4th and long", () => {
    expect(fourthDownDecision(fourthDown({ yardsToGo: 8, yardsToGoal: 25 }))).toBe(
      "field_goal",
    );
  });

  it("goes for it on 4th and inches near midfield", () => {
    expect(fourthDownDecision(fourthDown({ yardsToGo: 1, yardsToGoal: 45 }))).toBe(
      "go",
    );
  });

  it("goes for it on 4th and goal from the 2 rather than kicking", () => {
    // A chip shot is nearly free either way, so the bar to go is low.
    expect(fourthDownDecision(fourthDown({ yardsToGo: 2, yardsToGoal: 2 }))).toBe(
      "go",
    );
  });

  it("a trailing team late goes for it far more often than a leading one", () => {
    // The headline behavior: same field position, same distance, opposite
    // score. This is the whole reason the slice exists.
    let trailingGoes = 0;
    let leadingGoes = 0;
    for (let yardsToGo = 1; yardsToGo <= 10; yardsToGo++) {
      for (const yardsToGoal of [20, 40, 55, 70]) {
        const base = {
          yardsToGo,
          yardsToGoal,
          quarter: 4,
          clockSeconds: 100,
          isOvertime: false,
          aggression: 50,
        };
        if (fourthDownDecision({ ...base, scoreDiff: -10 }) === "go") {
          trailingGoes += 1;
        }
        if (fourthDownDecision({ ...base, scoreDiff: 10 }) === "go") {
          leadingGoes += 1;
        }
      }
    }
    expect(trailingGoes).toBeGreaterThan(leadingGoes * 2);
  });

  it("never punts while trailing in the last two minutes", () => {
    // A punt cannot win the game; it can only hand the ball back with less
    // time on the clock than you had.
    for (let yardsToGo = 1; yardsToGo <= 20; yardsToGo++) {
      for (const yardsToGoal of [15, 30, 50, 75, 95]) {
        const call = fourthDownDecision({
          yardsToGo,
          yardsToGoal,
          scoreDiff: -7,
          quarter: 4,
          clockSeconds: 90,
          isOvertime: false,
          aggression: 50,
        });
        expect(call).not.toBe("punt");
      }
    }
  });

  it("takes the tying field goal when three points are enough", () => {
    expect(
      fourthDownDecision({
        yardsToGo: 6,
        yardsToGoal: 20,
        scoreDiff: -3,
        quarter: 4,
        clockSeconds: 20,
        isOvertime: false,
        aggression: 50,
      }),
    ).toBe("field_goal");
  });

  it("does not kick a field goal that leaves it still losing", () => {
    // Down 7 with 20 seconds left, three points is a rounding error.
    expect(
      fourthDownDecision({
        yardsToGo: 6,
        yardsToGoal: 20,
        scoreDiff: -7,
        quarter: 4,
        clockSeconds: 20,
        isOvertime: false,
        aggression: 50,
      }),
    ).toBe("go");
  });

  it("is monotonic in aggression — a bolder coach never goes for it less", () => {
    for (let yardsToGo = 1; yardsToGo <= 12; yardsToGo++) {
      for (const yardsToGoal of [10, 30, 45, 60, 85]) {
        let sawGo = false;
        for (const aggression of [0, 25, 50, 75, 100]) {
          const goes =
            fourthDownDecision(
              fourthDown({ yardsToGo, yardsToGoal, aggression }),
            ) === "go";
          if (sawGo) expect(goes).toBe(true);
          if (goes) sawGo = true;
        }
      }
    }
  });

  it("is deterministic", () => {
    const input = fourthDown({ yardsToGo: 3, yardsToGoal: 42 });
    const first = fourthDownDecision(input);
    for (let i = 0; i < 20; i++) {
      expect(fourthDownDecision(input)).toBe(first);
    }
  });
});

describe("shouldOnside", () => {
  it("never onsides while level or ahead", () => {
    for (const scoreDiff of [0, 3, 14]) {
      expect(
        shouldOnside({ scoreDiff, quarter: 4, clockSeconds: 40, isOvertime: false }),
      ).toBe(false);
    }
  });

  it("onsides while trailing inside two minutes", () => {
    expect(
      shouldOnside({ scoreDiff: -6, quarter: 4, clockSeconds: 90, isOvertime: false }),
    ).toBe(true);
  });

  it("starts earlier when two possessions behind", () => {
    const base = { quarter: 4, clockSeconds: 200, isOvertime: false };
    expect(shouldOnside({ ...base, scoreDiff: -6 })).toBe(false);
    expect(shouldOnside({ ...base, scoreDiff: -14 })).toBe(true);
  });

  it("never onsides in the first half", () => {
    expect(
      shouldOnside({ scoreDiff: -20, quarter: 1, clockSeconds: 60, isOvertime: false }),
    ).toBe(false);
  });
});

describe("clockStrategy", () => {
  it("hurries at the end of the first half regardless of score", () => {
    for (const scoreDiff of [-7, 0, 7]) {
      expect(
        clockStrategy({ scoreDiff, quarter: 2, clockSeconds: 60, isOvertime: false }),
      ).toBe("hurry_up");
    }
  });

  it("hurries late only when it needs points", () => {
    expect(
      clockStrategy({ scoreDiff: -4, quarter: 4, clockSeconds: 90, isOvertime: false }),
    ).toBe("hurry_up");
    expect(
      clockStrategy({ scoreDiff: 4, quarter: 4, clockSeconds: 90, isOvertime: false }),
    ).toBe("burn");
  });

  it("is normal in the middle of the game", () => {
    expect(
      clockStrategy({ scoreDiff: 0, quarter: 2, clockSeconds: 600, isOvertime: false }),
    ).toBe("normal");
  });
});

describe("runoffSeconds", () => {
  it("charges nothing when the clock is stopped", () => {
    for (const s of ["normal", "hurry_up", "burn"] as const) {
      expect(runoffSeconds(s, true)).toBe(0);
    }
  });

  it("orders hurry-up below normal below burn", () => {
    expect(runoffSeconds("hurry_up", false)).toBeLessThan(
      runoffSeconds("normal", false),
    );
    expect(runoffSeconds("normal", false)).toBeLessThan(
      runoffSeconds("burn", false),
    );
  });
});

describe("shouldSpike", () => {
  const base = {
    strategy: "hurry_up" as const,
    secondsLeftInHalf: 25,
    down: 2,
    timeoutsRemaining: 0,
    clockStopped: false,
  };

  it("spikes with no timeouts left and the clock running out", () => {
    expect(shouldSpike(base)).toBe(true);
  });

  it("uses the timeout instead when it still has one", () => {
    expect(shouldSpike({ ...base, timeoutsRemaining: 2 })).toBe(false);
  });

  it("never spikes on 4th down — that surrenders the ball to save seconds", () => {
    expect(shouldSpike({ ...base, down: 4 })).toBe(false);
  });

  it("never spikes when the clock is already stopped", () => {
    expect(shouldSpike({ ...base, clockStopped: true })).toBe(false);
  });
});

describe("shouldUseTimeout", () => {
  const offense = {
    isOffense: true,
    scoreDiff: -3,
    secondsLeftInHalf: 60,
    secondsLeftInGame: 60,
    quarter: 4,
    timeoutsRemaining: 2,
    clockStopped: false,
  };

  it("never spends one it does not have", () => {
    expect(shouldUseTimeout({ ...offense, timeoutsRemaining: 0 })).toBe(false);
  });

  it("never spends one while the clock is already stopped", () => {
    expect(shouldUseTimeout({ ...offense, clockStopped: true })).toBe(false);
  });

  it("is spent by a trailing offense late", () => {
    expect(shouldUseTimeout(offense)).toBe(true);
  });

  it("is not spent by a leading offense late — it wants the clock running", () => {
    expect(shouldUseTimeout({ ...offense, scoreDiff: 7 })).toBe(false);
  });

  it("is spent by a trailing defense inside two minutes", () => {
    expect(
      shouldUseTimeout({
        isOffense: false,
        scoreDiff: -5,
        secondsLeftInHalf: 80,
        secondsLeftInGame: 80,
        quarter: 4,
        timeoutsRemaining: 3,
        clockStopped: false,
      }),
    ).toBe(true);
  });
});

describe("situational gate in the engine", () => {
  it("emits no A3 play type while the gate is off", () => {
    const plays = simulateMany(20, undefined, 8000);
    const v2Only = plays.filter((p) =>
      ["spike", "timeout", "onside_kick"].includes(p.playType),
    );
    expect(v2Only).toEqual([]);
    expect(plays.some((p) => p.tempo !== undefined)).toBe(false);
  });

  it("makes every A3 mechanic reachable across seeded games", () => {
    /*
     * A mechanic that can never fire is not implemented. This is the same
     * reachability discipline A1 adopted after safeties turned out to be
     * geometrically impossible.
     */
    const plays = simulateMany(120, SITUATIONAL, 12000);
    expect(plays.filter((p) => p.playType === "spike").length).toBeGreaterThan(0);
    expect(plays.filter((p) => p.playType === "timeout").length).toBeGreaterThan(0);
    expect(
      plays.filter((p) => p.playType === "onside_kick").length,
    ).toBeGreaterThan(0);
    expect(plays.filter((p) => p.tempo === "hurry_up").length).toBeGreaterThan(0);
    expect(plays.filter((p) => p.tempo === "burn").length).toBeGreaterThan(0);
  });

  it("never gives a team more than three timeouts in a half", () => {
    /*
     * The pool is per half, so counting timeout plays per (team, half) is the
     * direct assertion. An off-by-one in the reset would show up here as a
     * fourth timeout rather than as a negative counter, which is why this
     * counts events rather than reading engine state.
     */
    for (let i = 0; i < 200; i++) {
      const log = simulateGameLog({
        ...gameInput({ seed: 15000 + i }),
        features: SITUATIONAL,
      });
      const counts = new Map<string, number>();
      for (const play of allPlays(log)) {
        if (play.playType !== "timeout") continue;
        expect(play.timeoutTeamId).toBeDefined();
        // Overtime carries its own smaller pool, so key it separately.
        const period =
          play.quarter >= 5 ? `ot${play.quarter}` : play.quarter <= 2 ? "h1" : "h2";
        const key = `${play.timeoutTeamId}:${period}`;
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        expect(next).toBeLessThanOrEqual(period.startsWith("ot") ? 1 : 3);
      }
    }
  });

  it("keeps the clock and quarter monotonic, and never runs it on a timeout", () => {
    for (let i = 0; i < 200; i++) {
      const log = simulateGameLog({
        ...gameInput({ seed: 16000 + i }),
        features: SITUATIONAL,
      });
      const plays = allPlays(log);
      for (let p = 1; p < plays.length; p++) {
        const prev = plays[p - 1];
        const play = plays[p];
        expect(play.quarter).toBeGreaterThanOrEqual(prev.quarter);
        if (play.quarter === prev.quarter) {
          expect(play.clockSeconds).toBeLessThanOrEqual(prev.clockSeconds);
        }
        // A timeout stops the clock: the next play starts at the same second.
        if (prev.playType === "timeout" && play.quarter === prev.quarter) {
          expect(play.clockSeconds).toBe(prev.clockSeconds);
        }
        expect(play.clockSeconds).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("runs more plays than v1 in the same game", () => {
    // The clock model is the point: v1 charged a full huddle cycle even to an
    // incompletion, which is what capped the number of snaps.
    const v1 = simulateMany(40, undefined, 17000).length;
    const v2 = simulateMany(40, SITUATIONAL, 17000).length;
    expect(v2).toBeGreaterThan(v1);
  });

  it("lets a bold coach go for it more than a timid one", () => {
    const count = (aggression: number) => {
      let fourthDownGoes = 0;
      for (let i = 0; i < 60; i++) {
        const log = simulateGameLog({
          home: buildTeam("home", 70, aggression),
          away: buildTeam("away", 70, aggression),
          seed: 18000 + i,
          flavor: "balanced",
          features: SITUATIONAL,
        });
        for (const play of allPlays(log)) {
          if (
            play.down === 4 &&
            ["rush", "pass_complete", "pass_incomplete", "sack", "interception"].includes(
              play.playType,
            )
          ) {
            fourthDownGoes += 1;
          }
        }
      }
      return fourthDownGoes;
    };
    expect(count(95)).toBeGreaterThan(count(5));
  });
});

describe("balance gate (#642)", () => {
  /*
   * Two identical rosters. Any asymmetry in the result is the engine's, and the
   * point of this gate is that the measured home advantage should match the
   * constant that claims to produce it.
   */
  function evenSeries(features: PbpFeatureGates | undefined, games: number) {
    let homeWins = 0;
    let awayWins = 0;
    let homePoints = 0;
    let awayPoints = 0;
    for (let i = 0; i < games; i++) {
      const log = simulateGameLog({
        home: buildTeam("home", 70),
        away: buildTeam("away", 70),
        seed: 1000 + i,
        flavor: "balanced",
        features,
      });
      homePoints += log.homeScore;
      awayPoints += log.awayScore;
      if (log.homeScore > log.awayScore) homeWins += 1;
      else if (log.awayScore > log.homeScore) awayWins += 1;
    }
    return {
      homeWinRate: homeWins / games,
      awayWinRate: awayWins / games,
      meanHome: homePoints / games,
      meanAway: awayPoints / games,
      meanTotal: (homePoints + awayPoints) / games,
    };
  }

  it("documents the v1 numbers this gate exists to correct", () => {
    // Not a target — a pin. v1 is frozen so that already-simulated fixtures
    // stay reproducible, so these numbers must NOT drift silently.
    const v1 = evenSeries(undefined, 300);
    expect(v1.homeWinRate).toBeGreaterThan(0.63);
    expect(v1.meanTotal).toBeLessThan(28);
  });

  it("brings the home win rate back to what a small edge implies", () => {
    const full = evenSeries(
      { situational: true, balance: true, scoringV2: true, penalties: true },
      300,
    );
    expect(full.homeWinRate).toBeGreaterThan(0.52);
    expect(full.homeWinRate).toBeLessThan(0.6);
    expect(Math.abs(full.meanHome - full.meanAway)).toBeLessThan(3);
  });

  it("lands mean total points inside the design band of 30-60", () => {
    const full = evenSeries(
      { situational: true, balance: true, scoringV2: true, penalties: true },
      300,
    );
    expect(full.meanTotal).toBeGreaterThan(30);
    expect(full.meanTotal).toBeLessThan(60);
  });

  it("still favors the stronger team", () => {
    // Recalibrating home field must not flatten actual quality differences.
    let strongWins = 0;
    const games = 200;
    for (let i = 0; i < games; i++) {
      const log = simulateGameLog({
        home: buildTeam("home", 55),
        away: buildTeam("away", 85),
        seed: 21000 + i,
        flavor: "balanced",
        features: { situational: true, balance: true },
      });
      if (log.awayScore > log.homeScore) strongWins += 1;
    }
    expect(strongWins / games).toBeGreaterThan(0.65);
  });
});
