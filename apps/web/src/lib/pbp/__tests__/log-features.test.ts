import { describe, it, expect } from "vitest";
import { simulateGameLog } from "../engine";
import { logModels, normalizeGameLog } from "../migrate-log";
import { CLEAR_WEATHER } from "../weather";
import type {
  PbpGameInput,
  PlayerSimProfile,
  TeamSimProfile,
} from "../types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildRoster(teamId: string, strength: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
    ["QB", 2], ["RB", 3], ["WR", 5], ["TE", 2], ["DE", 2], ["DT", 2],
    ["OLB", 2], ["MLB", 2], ["CB", 3], ["S", 2], ["K", 1], ["P", 1],
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

const buildTeam = (teamId: string, strength: number): TeamSimProfile => ({
  teamId,
  strength,
  players: buildRoster(teamId, strength),
});

function gameInput(overrides: Partial<PbpGameInput> = {}): PbpGameInput {
  return {
    home: buildTeam("home", 70),
    away: buildTeam("away", 70),
    seed: 8080,
    flavor: "balanced",
    ...overrides,
  };
}

/*
 * The gates a game ran under are recorded ON the log (#646).
 *
 * The engine version cannot answer "were penalties modelled in this game?" —
 * one build writes both kinds depending on what the league had configured, and
 * a league that adopts a mechanic mid-season has both in one season.
 */
describe("recorded feature gates", () => {
  it("records nothing at all when no gate was on", () => {
    /*
     * Load-bearing for golden parity: a fully-gated-off log must stay
     * byte-identical to its v1 self, so the key cannot merely be empty — it
     * has to be absent.
     */
    const log = simulateGameLog(gameInput());
    expect(log.features).toBeUndefined();
    expect("features" in log).toBe(false);
  });

  it("records only the gates that were on", () => {
    const log = simulateGameLog(
      gameInput({ features: { penalties: true, situational: true } }),
    );
    expect(log.features).toEqual({ penalties: true, situational: true });
  });

  it("never records a gate as false", () => {
    // `false` would claim the engine considered a mechanic and declined, which
    // is indistinguishable in the data from a build that never had it.
    const log = simulateGameLog(
      gameInput({ features: { penalties: true, weather: false } }),
    );
    expect(log.features).toEqual({ penalties: true });
  });

  it("survives a serialize/parse round trip, which is how it is stored", () => {
    const log = simulateGameLog(
      gameInput({ features: { scoringV2: true, weather: true }, weather: CLEAR_WEATHER }),
    );
    const stored = normalizeGameLog(JSON.parse(JSON.stringify(log)), "2.0.0");
    expect(stored.features).toEqual({ scoringV2: true, weather: true });
  });
});

describe("logModels", () => {
  const normalize = (input: PbpGameInput, version = "2.0.0") =>
    normalizeGameLog(JSON.parse(JSON.stringify(simulateGameLog(input))), version);

  it("answers from the gates the game ran under, not the engine version", () => {
    const withPenalties = normalize(gameInput({ features: { penalties: true } }));
    const without = normalize(gameInput({ features: { scoringV2: true } }));

    // Same engine version, opposite answers — which a version number alone
    // could never produce.
    expect(withPenalties.engineVersion).toBe(without.engineVersion);
    expect(logModels(withPenalties, "penalties")).toBe(true);
    expect(logModels(without, "penalties")).toBe(false);
  });

  it("maps each mechanic to the gate that produces it", () => {
    const log = normalize(
      gameInput({ features: { scoringV2: true, situational: true } }),
    );
    expect(logModels(log, "safeties")).toBe(true);
    expect(logModels(log, "twoPointConversions")).toBe(true);
    expect(logModels(log, "returns")).toBe(true);
    expect(logModels(log, "fourthDownAi")).toBe(true);
    expect(logModels(log, "timeouts")).toBe(true);
    expect(logModels(log, "penalties")).toBe(false);
    expect(logModels(log, "weather")).toBe(false);
  });

  it("says a v1 log modelled nothing", () => {
    const v1 = normalizeGameLog({ drives: [] }, "1.0.0");
    expect(logModels(v1, "returns")).toBe(false);
    expect(logModels(v1, "penalties")).toBe(false);
    expect(logModels(v1, "safeties")).toBe(false);
  });

  it("treats a gated-off v2 log exactly like a v1 log", () => {
    // Both claim "this mechanic was not modelled here". Same claim, same
    // answer — a reader must show "—" for either.
    const gatedOff = normalize(gameInput());
    const v1 = normalizeGameLog({ drives: [] }, "1.0.0");
    for (const mechanic of ["returns", "penalties", "safeties"] as const) {
      expect(logModels(gatedOff, mechanic)).toBe(logModels(v1, mechanic));
    }
  });

  it("treats an unreadable features value as modelling nothing", () => {
    const log = normalizeGameLog({ drives: [], features: "yes" }, "2.0.0");
    expect(logModels(log, "penalties")).toBe(false);
  });
});

describe("box score penalty reporting", () => {
  it("reports a clean game as 0, not as unmodelled", async () => {
    /*
     * The case the old play-scan heuristic got wrong. A game simulated WITH
     * penalties enabled that drew no flags is a clean game — reporting "—"
     * would hide a real result behind "unknown".
     */
    const { logModelsPenalties } = await import("@/lib/gamecast/box-score");
    const cleanGame = {
      ...simulateGameLog(gameInput()),
      features: { penalties: true },
    };
    expect(logModelsPenalties(cleanGame)).toBe(true);
  });

  it("still reads a pre-gate log by scanning its plays", async () => {
    const { logModelsPenalties } = await import("@/lib/gamecast/box-score");
    const log = simulateGameLog(gameInput({ features: { penalties: true } }));
    // Strip the recorded gates to stand in for a log written before them.
    const { features: _dropped, ...preGate } = log;
    const drewAFlag = preGate.drives.some((d) =>
      d.plays.some((p) => p.penalty !== undefined),
    );
    expect(logModelsPenalties(preGate)).toBe(drewAFlag);
  });
});
