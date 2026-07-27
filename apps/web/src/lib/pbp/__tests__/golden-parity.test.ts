import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { simulateGameLog } from "../engine";
import { normalizeGameLog, logModels } from "../migrate-log";
import type {
  PbpGameInput,
  PlayerSimProfile,
  TeamSimProfile,
} from "../types";
import golden from "./fixtures/v1-golden-logs.json";

/*
 * Golden-log parity (Dynasty Mode A1) — the guard for every Epic A slice.
 *
 * The engine is shared by every league that has ever simulated a game. Changing
 * how it plays out is sometimes intended (see #642) but must never be
 * accidental, and "accidental" is easy here: the PRNG is a sequence, so a
 * single stray `rand()` inside a disabled feature shifts every later draw and
 * silently rewrites the whole game.
 *
 * So: with v2 features OFF, the engine must reproduce the pinned v1 logs
 * byte-for-byte. Regenerate the fixture with `scripts/gen-v1-golden.ts` ONLY
 * when a v1 behavior change is deliberate, and call the diff out in the PR.
 */

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

function buildTeam(teamId: string, strength: number): TeamSimProfile {
  return { teamId, strength, players: buildRoster(teamId, strength) };
}

function inputFor(c: (typeof golden.cases)[number]): PbpGameInput {
  return {
    home: buildTeam("home", c.homeStrength),
    away: buildTeam("away", c.awayStrength),
    seed: c.seed,
    decisive: c.decisive,
    flavor: c.flavor as PbpGameInput["flavor"],
  };
}

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("v1 golden parity (features off)", () => {
  it("pins four cases spanning even, mismatch, upsets and decisive", () => {
    expect(golden.cases).toHaveLength(4);
    expect(golden.engineVersion).toBe("1.0.0");
  });

  for (const c of golden.cases) {
    it(`reproduces "${c.name}" byte-for-byte`, () => {
      const log = simulateGameLog(inputFor(c));
      expect(sha(log)).toBe(c.sha256);
      // Cheap, readable assertions first so a failure says WHAT drifted
      // before the hash says THAT it drifted.
      expect(log.homeScore).toBe(c.homeScore);
      expect(log.awayScore).toBe(c.awayScore);
      expect(log.drives).toHaveLength(c.driveCount);
      expect(log.drives.reduce((n, d) => n + d.plays.length, 0)).toBe(
        c.playCount,
      );
    });
  }

  it("gives a deep-equal diff for the case that stores its full log", () => {
    const c = golden.cases[0]!;
    expect(c.log).toBeDefined();
    expect(simulateGameLog(inputFor(c))).toEqual(c.log);
  });

  it("treats an explicitly-disabled gate the same as an omitted one", () => {
    const c = golden.cases[0]!;
    const omitted = simulateGameLog(inputFor(c));
    const explicit = simulateGameLog({
      ...inputFor(c),
      features: { scoringV2: false },
    });
    expect(sha(explicit)).toBe(sha(omitted));
  });

  it("emits no v2-only play types while the gate is off", () => {
    const v2Only = new Set([
      "two_point_convert",
      "two_point_fail",
      "safety",
      "onside_kick",
      "penalty",
      "spike",
      "timeout",
    ]);
    for (const c of golden.cases) {
      const log = simulateGameLog(inputFor(c));
      const types = log.drives.flatMap((d) => d.plays.map((p) => p.playType));
      expect(types.filter((t) => v2Only.has(t))).toEqual([]);
    }
  });
});

describe("v2 enabled", () => {
  it("diverges from v1 — proving the gate is actually wired", () => {
    // A gate that changed nothing when flipped would make the parity tests
    // above vacuous.
    const c = golden.cases[0]!;
    const v2 = simulateGameLog({
      ...inputFor(c),
      features: { scoringV2: true },
    });
    expect(sha(v2)).not.toBe(c.sha256);
  });

  it("keeps the serialized log well under the 400KB budget", () => {
    for (const c of golden.cases) {
      const v2 = simulateGameLog({
        ...inputFor(c),
        features: { scoringV2: true },
      });
      expect(JSON.stringify(v2).length).toBeLessThan(400_000);
    }
  });

  it("scores consistently: 6*TD + XP + 3*FG + 2*safety + 2*two-point", () => {
    for (const c of golden.cases) {
      const log = simulateGameLog({
        ...inputFor(c),
        features: { scoringV2: true },
      });
      const plays = log.drives.flatMap((d) => d.plays);

      for (const teamId of [log.homeTeamId, log.awayTeamId]) {
        const offense = plays
          .filter((p) => p.offenseTeamId === teamId)
          .reduce((n, p) => n + p.pointsScored, 0);
        // Points the team scored while on DEFENSE (safeties, return TDs).
        const defense = plays
          .filter((p) => p.defenseTeamId === teamId)
          .reduce((n, p) => n + (p.defensivePoints ?? 0), 0);
        const expected = teamId === log.homeTeamId ? log.homeScore : log.awayScore;
        expect(offense + defense).toBe(expected);
      }
    }
  });

  it("never lets a two-point try coexist with an extra point on the same score", () => {
    for (const c of golden.cases) {
      const log = simulateGameLog({
        ...inputFor(c),
        features: { scoringV2: true },
      });
      const plays = log.drives.flatMap((d) => d.plays);
      const tries = plays.filter((p) =>
        ["extra_point", "extra_point_miss", "two_point_convert", "two_point_fail"].includes(
          p.playType,
        ),
      );
      const touchdowns = plays.filter((p) => p.pointsScored === 6).length;
      // Exactly one conversion attempt per touchdown.
      expect(tries).toHaveLength(touchdowns);
    }
  });
});

describe("normalizeGameLog", () => {
  it("reads a stored v1 log without inventing v2 data", () => {
    const raw = golden.cases[0]!.log;
    const normalized = normalizeGameLog(raw, "1.0.0");

    expect(normalized.engineVersion).toBe("1.0.0");
    expect(normalized.upconverted).toBe(true);
    expect(normalized.homeScore).toBe(golden.cases[0]!.homeScore);
    expect(normalized.drives).toHaveLength(golden.cases[0]!.driveCount);

    // Absent means "this engine did not model it", NOT zero. Defaulting to 0
    // would turn unknown into a factual claim the record book later trusts.
    const play = normalized.drives[0]!.plays[0]!;
    expect(play.returnYards).toBeUndefined();
    expect(play.defensivePoints).toBeUndefined();
    expect(logModels(normalized, "safeties")).toBe(false);
    expect(logModels(normalized, "penalties")).toBe(false);
  });

  it("degrades a corrupt blob to an empty log rather than throwing", () => {
    // One bad row should cost one Gamecast, not the page listing it.
    for (const bad of [null, undefined, "nonsense", 42, [], {}]) {
      const normalized = normalizeGameLog(bad, "1.0.0");
      expect(normalized.drives).toEqual([]);
      expect(normalized.homeScore).toBe(0);
    }
  });

  it("marks a current-engine log as not upconverted", () => {
    const v2 = simulateGameLog({
      ...inputFor(golden.cases[0]!),
      features: { scoringV2: true },
    });
    const normalized = normalizeGameLog(v2, "2.0.0");
    expect(normalized.upconverted).toBe(false);
    expect(logModels(normalized, "safeties")).toBe(true);
    // Penalties still arrive in A2, so this stays false even on a v2 log.
    expect(logModels(normalized, "penalties")).toBe(false);
  });
});

describe("v2 mechanics are reachable", () => {
  /*
   * A mechanic that is implemented but can never fire is not implemented.
   *
   * Safeties were exactly that at first: v1 clamped every drive start to the
   * 15, so being pinned deep enough to concede one was geometrically
   * impossible, and 200 games produced zero. This test is why that was caught
   * rather than shipped as a silent no-op.
   *
   * Bounds are loose on purpose — this asserts REACHABILITY, not balance.
   * Scoring balance is #642 and belongs to a tuning slice.
   */
  it("produces every A1 mechanic across 200 seeded games", () => {
    const counts = {
      safety: 0,
      twoPoint: 0,
      returnTd: 0,
      stripSack: 0,
    };

    for (let i = 0; i < 200; i++) {
      const log = simulateGameLog({
        home: buildTeam("home", 70),
        away: buildTeam("away", 70),
        seed: 7000 + i,
        flavor: "balanced",
        features: { scoringV2: true },
      });
      for (const drive of log.drives) {
        for (const play of drive.plays) {
          if (play.playType === "safety") counts.safety += 1;
          if (
            play.playType === "two_point_convert" ||
            play.playType === "two_point_fail"
          ) {
            counts.twoPoint += 1;
          }
          if (play.isReturnTd) counts.returnTd += 1;
          if (play.playType === "sack" && play.isTurnover) counts.stripSack += 1;
        }
      }
    }

    expect(counts.safety).toBeGreaterThan(0);
    expect(counts.twoPoint).toBeGreaterThan(0);
    expect(counts.returnTd).toBeGreaterThan(0);
    expect(counts.stripSack).toBeGreaterThan(0);

    // Upper bounds guard against a mechanic firing absurdly often — a safety
    // every other game would be as wrong as never.
    expect(counts.safety).toBeLessThan(200);
    expect(counts.returnTd).toBeLessThan(200);
  });
});
