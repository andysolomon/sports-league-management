import { describe, it, expect } from "vitest";
import { simulateGameLog } from "../engine";
import {
  chargeSnap,
  effectiveOverall,
  snapCost,
  staminaDecay,
  substitutionCandidate,
  type SnapLedger,
} from "../fatigue";
import { INJURY_TABLE, contactFactor, isAvailable, projectedReturnWeek, rollInjury } from "../injuries";
import type { PbpGameInput, PlayerSimProfile, TeamSimProfile } from "../types";

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
        endurance: 70,
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

function gameInput(overrides: Partial<PbpGameInput> = {}): PbpGameInput {
  return {
    home: team("home", 70),
    away: team("away", 70),
    seed: 9100,
    flavor: "balanced",
    ...overrides,
  };
}

describe("fatigue", () => {
  it("drains stamina monotonically as snaps accumulate", () => {
    let previous = 1;
    for (let snaps = 0; snaps <= 60; snaps += 5) {
      const stamina = staminaDecay(snaps);
      expect(stamina).toBeLessThanOrEqual(previous);
      previous = stamina;
    }
    expect(staminaDecay(0)).toBe(1);
    expect(staminaDecay(1000)).toBe(0);
  });

  it("lowers effective overall monotonically with accumulated snaps", () => {
    let previous = Infinity;
    for (let snaps = 0; snaps <= 60; snaps += 5) {
      const value = effectiveOverall(80, staminaDecay(snaps));
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it("never drops a player below a floor", () => {
    // A gassed starter is still a varsity player. Approaching zero would make
    // weighted selection behave as if he had left the field.
    expect(effectiveOverall(45, 0)).toBeGreaterThanOrEqual(40);
    expect(effectiveOverall(99, 0)).toBeGreaterThan(80);
  });

  it("lets a high-endurance player last longer at the same workload", () => {
    expect(staminaDecay(30, 95)).toBeGreaterThan(staminaDecay(30, 45));
  });

  it("charges a carry more than an incompletion, and nothing for a timeout", () => {
    expect(snapCost("rush")).toBeGreaterThan(snapCost("pass_incomplete"));
    expect(snapCost("timeout")).toBe(0);
    expect(snapCost("penalty")).toBe(0);
  });
});

describe("substitutionCandidate", () => {
  const players = roster("home", 70).filter((p) => p.position === "RB");

  it("leaves a fresh starter alone", () => {
    expect(substitutionCandidate(players, () => 1)).toBeNull();
  });

  it("does not sub in someone worse, even for an exhausted starter", () => {
    // A team with no depth plays its tired starter. That consequence is the
    // whole reason the mechanic exists — rotating to a worse player would
    // quietly remove it.
    const ledger: SnapLedger = new Map();
    chargeSnap(ledger, players[0].playerId, 100);
    const onlyStarter = [players[0]];
    expect(
      substitutionCandidate(onlyStarter, (p) =>
        staminaDecay(ledger.get(p.playerId) ?? 0, p.endurance),
      ),
    ).toBeNull();
  });

  it("brings on a fresh backup who is better right now", () => {
    const gassed = { ...players[0], overall: 75 };
    const fresh = { ...players[1], overall: 70 };
    const relief = substitutionCandidate([gassed, fresh], (p) =>
      p.playerId === gassed.playerId ? 0 : 1,
    );
    expect(relief?.playerId).toBe(fresh.playerId);
  });
});

describe("rollInjury", () => {
  const roll = (over: Partial<Parameters<typeof rollInjury>[0]> = {}) =>
    rollInjury({
      playType: "rush",
      stamina: 1,
      severityScale: 1,
      rolls: [0, 0.5],
      ...over,
    });

  it("never injures anyone when the league dial is zero", () => {
    // A true off switch, not a rare-events mode.
    for (let i = 0; i < 200; i++) {
      expect(roll({ severityScale: 0, rolls: [0, i / 200] })).toBeNull();
    }
  });

  it("cannot injure anyone on a play with no contact", () => {
    expect(roll({ playType: "timeout" })).toBeNull();
    expect(roll({ playType: "penalty" })).toBeNull();
  });

  it("hurts tired players more often than fresh ones", () => {
    const rate = (stamina: number) => {
      let hurt = 0;
      for (let i = 0; i < 4000; i++) {
        if (roll({ stamina, rolls: [i / 4000, 0.5] })) hurt += 1;
      }
      return hurt;
    };
    expect(rate(0)).toBeGreaterThan(rate(1));
  });

  it("hurts people more on violent plays than on gentle ones", () => {
    const rate = (playType: Parameters<typeof contactFactor>[0]) => {
      let hurt = 0;
      for (let i = 0; i < 4000; i++) {
        if (roll({ playType, rolls: [i / 4000, 0.5] })) hurt += 1;
      }
      return hurt;
    };
    expect(rate("sack")).toBeGreaterThan(rate("rush"));
    expect(rate("rush")).toBeGreaterThan(rate("pass_incomplete"));
    expect(rate("pass_incomplete")).toBeGreaterThan(rate("extra_point"));
  });

  it("keeps gamesOut inside the band its severity declares", () => {
    for (let i = 0; i < 500; i++) {
      const outcome = roll({ rolls: [0, i / 500] });
      if (!outcome) continue;
      const spec = INJURY_TABLE[outcome.severity];
      expect(outcome.gamesOut).toBeGreaterThanOrEqual(spec.minGames);
      expect(outcome.gamesOut).toBeLessThanOrEqual(spec.maxGames);
    }
  });

  it("skews a brutal league toward worse injuries, not just more of them", () => {
    const severeShare = (severityScale: number) => {
      let severe = 0;
      let total = 0;
      for (let i = 0; i < 2000; i++) {
        const outcome = roll({ severityScale, rolls: [0, i / 2000] });
        if (!outcome) continue;
        total += 1;
        if (outcome.severity === "major" || outcome.severity === "severe") severe += 1;
      }
      return severe / total;
    };
    expect(severeShare(2)).toBeGreaterThan(severeShare(1));
  });
});

describe("availability", () => {
  it("counts games, not weeks", () => {
    // A bye heals nobody. The player misses the games he was given, whenever
    // those games happen.
    expect(isAvailable({ gamesOut: 2, status: "out" })).toBe(false);
    expect(isAvailable({ gamesOut: 0, status: "out" })).toBe(true);
    expect(isAvailable({ gamesOut: 3, status: "healed" })).toBe(true);
    expect(isAvailable(null)).toBe(true);
  });

  it("projects a return week without deciding anything from it", () => {
    expect(projectedReturnWeek(6, 3)).toBe(9);
    expect(projectedReturnWeek(6, 0)).toBe(6);
  });
});

describe("the injuries gate", () => {
  it("reproduces the pre-A4 log byte for byte when disabled", () => {
    // Parity is the contract every Epic A slice inherits: with the gate off the
    // engine must draw the same numbers in the same order as before it existed.
    const before = simulateGameLog(
      gameInput({ features: { scoringV2: true, penalties: true, situational: true } }),
    );
    const withDialButNoGate = simulateGameLog(
      gameInput({
        features: { scoringV2: true, penalties: true, situational: true },
        injurySeverityScale: 2,
      }),
    );
    expect(withDialButNoGate).toEqual(before);
    expect(before.injuries).toBeUndefined();
  });

  it("records an empty list rather than nothing when it modelled no injuries", () => {
    // Absence means "not modelled"; an empty array means "modelled, nobody
    // got hurt". A reader must be able to tell those apart.
    const log = simulateGameLog(
      gameInput({ features: { injuries: true }, injurySeverityScale: 0 }),
    );
    expect(log.injuries).toEqual([]);
  });

  it("keeps a knocked-out player off the field for the rest of the game", () => {
    for (let seed = 9000; seed < 9120; seed++) {
      const log = simulateGameLog(
        gameInput({ seed, features: { injuries: true }, injurySeverityScale: 2 }),
      );
      const plays = log.drives.flatMap((d) => d.plays);
      for (const injury of log.injuries ?? []) {
        if (injury.gamesOut <= 0) continue;
        const at = plays.findIndex(
          (p) =>
            p.injury?.playerId === injury.playerId &&
            p.injury?.gamesOut === injury.gamesOut &&
            p.injury?.severity === injury.severity,
        );
        const playedAgain = plays
          .slice(at + 1)
          .some((p) => p.participants.some((q) => q.playerId === injury.playerId));
        expect(playedAgain).toBe(false);
      }
    }
  });

  it("stays inside the balance band of 0-2 injuries per game", () => {
    let total = 0;
    const games = 200;
    for (let seed = 9000; seed < 9000 + games; seed++) {
      const log = simulateGameLog(
        gameInput({ seed, features: { injuries: true } }),
      );
      total += (log.injuries ?? []).length;
    }
    const perGame = total / games;
    expect(perGame).toBeGreaterThan(0);
    expect(perGame).toBeLessThanOrEqual(2);
  });
});
