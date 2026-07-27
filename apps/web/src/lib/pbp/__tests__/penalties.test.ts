import { describe, it, expect } from "vitest";
import { simulateGameLog } from "../engine";
import { deriveStatLines } from "../derive-stats";
import {
  PENALTY_TABLE,
  acceptOrDecline,
  disciplineMultiplier,
  meanAwareness,
  rollPenalty,
} from "../penalties";
import type {
  PbpGameInput,
  PlayerSimProfile,
  TeamSimProfile,
} from "../types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildRoster(
  teamId: string,
  strength: number,
  awareness?: number,
): PlayerSimProfile[] {
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
        awareness,
      });
    }
  }
  return players;
}

function buildTeam(
  teamId: string,
  strength: number,
  discipline?: number,
): TeamSimProfile {
  return {
    teamId,
    strength,
    players: buildRoster(teamId, strength, discipline),
    discipline,
  };
}

function gameInput(overrides: Partial<PbpGameInput> = {}): PbpGameInput {
  return {
    home: buildTeam("home", 70),
    away: buildTeam("away", 70),
    seed: 4242,
    flavor: "balanced",
    ...overrides,
  };
}

describe("PENALTY_TABLE", () => {
  it("covers pre-snap and live-ball fouls on both sides", () => {
    expect(PENALTY_TABLE.some((p) => p.preSnap && p.onOffense)).toBe(true);
    expect(PENALTY_TABLE.some((p) => p.preSnap && !p.onOffense)).toBe(true);
    expect(PENALTY_TABLE.some((p) => !p.preSnap && p.onOffense)).toBe(true);
    expect(PENALTY_TABLE.some((p) => !p.preSnap && !p.onOffense)).toBe(true);
  });

  it("gives every entry positive yardage and weight", () => {
    for (const def of PENALTY_TABLE) {
      expect(def.yards).toBeGreaterThan(0);
      expect(def.weight).toBeGreaterThan(0);
      expect(def.code).toMatch(/^[a-z_]+$/);
    }
  });

  it("only awards automatic first downs on defensive fouls", () => {
    for (const def of PENALTY_TABLE) {
      if (def.automaticFirstDown) expect(def.onOffense).toBe(false);
    }
  });
});

describe("disciplineMultiplier", () => {
  it("is neutral at 50 awareness and inverts with it", () => {
    expect(disciplineMultiplier(50)).toBeCloseTo(1, 5);
    expect(disciplineMultiplier(85)).toBeLessThan(1);
    expect(disciplineMultiplier(30)).toBeGreaterThan(1);
  });

  it("stays bounded so no roster is penalty-proof or unplayable", () => {
    for (const awr of [0, 1, 50, 99, 200, -50]) {
      const m = disciplineMultiplier(awr);
      expect(m).toBeGreaterThanOrEqual(0.55);
      expect(m).toBeLessThanOrEqual(1.6);
    }
  });
});

describe("meanAwareness", () => {
  it("falls back to overall per player when awareness is missing", () => {
    expect(
      meanAwareness([{ overall: 70 }, { overall: 80 }], 0),
    ).toBeCloseTo(75);
  });

  it("uses the fallback for an empty roster rather than dividing by zero", () => {
    expect(meanAwareness([], 62)).toBe(62);
  });
});

describe("rollPenalty", () => {
  it("never flags a play type that cannot draw one", () => {
    for (const playType of ["extra_point", "kneel", "safety"] as const) {
      const rolled = rollPenalty({
        rand: () => 0, // always "flag" if the type allowed it
        playType,
        offenseDiscipline: 50,
        defenseDiscipline: 50,
      });
      expect(rolled).toBeNull();
    }
  });

  it("returns null without a second draw on a clean play", () => {
    // A clean play must cost exactly ONE random number regardless of table
    // size, or the PRNG sequence would depend on how many penalties exist.
    let draws = 0;
    const rand = () => {
      draws += 1;
      return 0.99;
    };
    expect(
      rollPenalty({
        rand,
        playType: "rush",
        offenseDiscipline: 50,
        defenseDiscipline: 50,
      }),
    ).toBeNull();
    expect(draws).toBe(1);
  });

  it("returns a table entry when the roll lands", () => {
    const rolled = rollPenalty({
      rand: () => 0,
      playType: "rush",
      offenseDiscipline: 50,
      defenseDiscipline: 50,
    });
    expect(rolled).not.toBeNull();
    expect(PENALTY_TABLE).toContain(rolled!.def);
    expect(rolled!.yards).toBe(rolled!.def.yards);
  });
});

describe("acceptOrDecline", () => {
  const offensiveHold = PENALTY_TABLE.find((p) => p.code === "holding_offense")!;
  const defensiveHold = PENALTY_TABLE.find((p) => p.code === "holding_defense")!;
  const falseStart = PENALTY_TABLE.find((p) => p.code === "false_start")!;

  it("always accepts a pre-snap flag — there is no play to weigh", () => {
    expect(
      acceptOrDecline({
        penalty: falseStart,
        playYards: 40,
        playIsScoring: false,
        playIsTurnover: false,
        distance: 10,
      }).accepted,
    ).toBe(true);
  });

  it("declines an offensive foul that would give back a turnover", () => {
    // Never hand the ball back for 10 yards.
    const d = acceptOrDecline({
      penalty: offensiveHold,
      playYards: 0,
      playIsScoring: false,
      playIsTurnover: true,
      distance: 10,
    });
    expect(d.accepted).toBe(false);
    expect(d.reason).toMatch(/turnover/);
  });

  it("accepts an offensive foul that wipes out a touchdown", () => {
    expect(
      acceptOrDecline({
        penalty: offensiveHold,
        playYards: 60,
        playIsScoring: true,
        playIsTurnover: false,
        distance: 10,
      }).accepted,
    ).toBe(true);
  });

  it("declines an offensive foul when the play already lost more", () => {
    expect(
      acceptOrDecline({
        penalty: offensiveHold,
        playYards: -12,
        playIsScoring: false,
        playIsTurnover: false,
        distance: 10,
      }).accepted,
    ).toBe(false);
  });

  it("declines a defensive foul when the offense already scored", () => {
    expect(
      acceptOrDecline({
        penalty: defensiveHold,
        playYards: 30,
        playIsScoring: true,
        playIsTurnover: false,
        distance: 10,
      }).accepted,
    ).toBe(false);
  });

  it("accepts a defensive foul that erases the offense's own turnover", () => {
    expect(
      acceptOrDecline({
        penalty: defensiveHold,
        playYards: 0,
        playIsScoring: false,
        playIsTurnover: true,
        distance: 10,
      }).accepted,
    ).toBe(true);
  });

  it("declines a defensive foul when the play already made the line", () => {
    // 5-yard defensive holding is worth less than a 20-yard gain on 3rd-and-10,
    // even with the automatic first down, because the play got it anyway.
    const d = acceptOrDecline({
      penalty: defensiveHold,
      playYards: 20,
      playIsScoring: false,
      playIsTurnover: false,
      distance: 10,
    });
    expect(d.accepted).toBe(false);
  });

  it("is deterministic — same inputs, same call, every time", () => {
    const args = {
      penalty: offensiveHold,
      playYards: 7,
      playIsScoring: false,
      playIsTurnover: false,
      distance: 10,
    };
    const first = acceptOrDecline(args);
    for (let i = 0; i < 20; i++) expect(acceptOrDecline(args)).toEqual(first);
  });
});

describe("penalties in the engine", () => {
  it("emits none while the gate is off", () => {
    const log = simulateGameLog(gameInput());
    const flagged = log.drives
      .flatMap((d) => d.plays)
      .filter((p) => p.penalty !== undefined);
    expect(flagged).toEqual([]);
  });

  it("emits flags once enabled", () => {
    const log = simulateGameLog({
      ...gameInput(),
      features: { penalties: true },
    });
    const flagged = log.drives
      .flatMap((d) => d.plays)
      .filter((p) => p.penalty !== undefined);
    expect(flagged.length).toBeGreaterThan(0);
  });

  it("credits no stats for a play an accepted penalty negated", () => {
    // The whole point: a 40-yard run wiped by holding must not show up in a
    // rushing total that Epic D's record book will later treat as history.
    //
    // Scan seeds until a negated play appears — one game does not reliably
    // contain one, and asserting on a single game would be flaky.
    let log = simulateGameLog({ ...gameInput(), features: { penalties: true } });
    for (let i = 0; i < 50; i++) {
      const candidate = simulateGameLog({
        ...gameInput({ seed: 31000 + i }),
        features: { penalties: true },
      });
      if (candidate.drives.flatMap((d) => d.plays).some((p) => p.penalty?.negatesPlay)) {
        log = candidate;
        break;
      }
    }

    const negated = log.drives
      .flatMap((d) => d.plays)
      .filter((p) => p.penalty?.negatesPlay);
    expect(negated.length).toBeGreaterThan(0);

    const lines = deriveStatLines(log);
    const withoutNegated = deriveStatLines({
      ...log,
      drives: log.drives.map((d) => ({
        ...d,
        plays: d.plays.filter((p) => !p.penalty?.negatesPlay),
      })),
    });
    // Removing the negated plays entirely changes nothing, which proves they
    // contributed nothing in the first place.
    expect(lines).toEqual(withoutNegated);
  });

  it("leaves the play standing when the flag is declined", () => {
    // Declines are rarer than accepts, so aggregate across seeds rather than
    // hoping one game contains one.
    const declined = [];
    for (let i = 0; i < 60; i++) {
      const log = simulateGameLog({
        ...gameInput({ seed: 41000 + i }),
        features: { penalties: true },
      });
      declined.push(
        ...log.drives
          .flatMap((d) => d.plays)
          .filter((p) => p.penalty && !p.penalty.accepted),
      );
    }

    for (const play of declined) {
      // A declined flag is recorded for the play-by-play but must never be
      // marked as negating, and must never zero out the play's yardage.
      expect(play.penalty!.negatesPlay).toBe(false);
    }
    expect(declined.length).toBeGreaterThan(0);
  });

  it("flags an undisciplined team more than a disciplined one", () => {
    const count = (discipline: number) => {
      let flags = 0;
      for (let i = 0; i < 120; i++) {
        const log = simulateGameLog({
          home: buildTeam("home", 70, discipline),
          away: buildTeam("away", 70, discipline),
          seed: 9000 + i,
          flavor: "balanced",
          features: { penalties: true },
        });
        flags += log.drives
          .flatMap((d) => d.plays)
          .filter((p) => p.penalty !== undefined).length;
      }
      return flags;
    };

    const sloppy = count(60);
    const sharp = count(85);
    expect(sloppy).toBeGreaterThan(sharp);
  });

  it("lands in a believable flags-per-team-per-game range", () => {
    /*
     * Reachability and sanity, not balance. Scoring balance stays with #642;
     * this only asserts the penalty rate is neither invisible nor absurd.
     */
    let flags = 0;
    const games = 200;
    for (let i = 0; i < games; i++) {
      const log = simulateGameLog({
        ...gameInput({ seed: 20000 + i }),
        features: { penalties: true },
      });
      flags += log.drives
        .flatMap((d) => d.plays)
        .filter((p) => p.penalty !== undefined).length;
    }
    const perTeamPerGame = flags / games / 2;
    expect(perTeamPerGame).toBeGreaterThan(1);
    expect(perTeamPerGame).toBeLessThan(12);
  });
});
