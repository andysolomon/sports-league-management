import { describe, it, expect } from "vitest";
import {
  normalizeSimulationFlavor,
  weightsForFlavor,
  BASE_STRENGTH_WEIGHT,
  BASE_VARIANCE,
} from "../simulation-flavor";
import { simulateScore } from "../simulate-game";
import { simulateGameLog } from "../pbp";
import type { TeamSimProfile } from "../pbp";

const team = (id: string, strength: number): TeamSimProfile => ({
  teamId: id,
  strength,
  players: [],
});

describe("simulation flavor weighting", () => {
  it("defaults missing values to balanced", () => {
    expect(normalizeSimulationFlavor(undefined)).toBe("balanced");
    expect(normalizeSimulationFlavor("legacy")).toBe("balanced");
  });

  it("keeps balanced constants identical to the legacy engine", () => {
    const weights = weightsForFlavor("balanced");
    expect(weights.strengthWeight).toBe(BASE_STRENGTH_WEIGHT);
    expect(weights.variance).toBe(BASE_VARIANCE);
    expect(weights.edgeScale).toBe(1);
  });

  it("is deterministic per fixture seed and flavor", () => {
    const input = { homeStrength: 68, awayStrength: 61, seed: 90210 };
    const balancedA = simulateScore({ ...input, flavor: "balanced" });
    const balancedB = simulateScore({ ...input, flavor: "balanced" });
    expect(balancedA).toEqual(balancedB);
  });

  it("changes score weighting across chalk, balanced, and upsets", () => {
    const seed = 4242;
    const homeStrength = 78;
    const awayStrength = 52;
    const flavors = ["chalk", "balanced", "upsets"] as const;
    const scores = flavors.map((flavor) =>
      simulateScore({ homeStrength, awayStrength, seed, flavor }),
    );
    expect(new Set(scores.map((s) => `${s.homeScore}-${s.awayScore}`)).size).toBe(
      3,
    );
  });

  it("lets chalk favor the stronger team more often than upsets", () => {
    let chalkStrongWins = 0;
    let upsetStrongWins = 0;
    const N = 300;
    for (let seed = 0; seed < N; seed++) {
      const chalk = simulateScore({
        homeStrength: 74,
        awayStrength: 54,
        seed,
        flavor: "chalk",
      });
      const upsets = simulateScore({
        homeStrength: 74,
        awayStrength: 54,
        seed,
        flavor: "upsets",
      });
      if (chalk.homeScore > chalk.awayScore) chalkStrongWins++;
      if (upsets.homeScore > upsets.awayScore) upsetStrongWins++;
    }
    expect(chalkStrongWins).toBeGreaterThan(upsetStrongWins);
  });

  it("changes PBP logs for the same seed when flavor changes", () => {
    const home = team("home", 70);
    const away = team("away", 58);
    const seed = 1337;
    const balanced = simulateGameLog({ home, away, seed, flavor: "balanced" });
    const chalk = simulateGameLog({ home, away, seed, flavor: "chalk" });
    const upsets = simulateGameLog({ home, away, seed, flavor: "upsets" });
    expect(chalk.homeScore).not.toBe(upsets.homeScore);
    expect(balanced.drives.length).toBeGreaterThan(0);
    expect(chalk).not.toEqual(upsets);
  });
});
