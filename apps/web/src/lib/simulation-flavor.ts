/** Season-scoped simulation tuning (WSM-000244). */
export type SimulationFlavor = "chalk" | "balanced" | "upsets";

export const SIMULATION_FLAVORS: SimulationFlavor[] = [
  "chalk",
  "balanced",
  "upsets",
];

export const DEFAULT_SIMULATION_FLAVOR: SimulationFlavor = "balanced";

/** Map legacy/missing rows to the neutral default at read time. */
export function normalizeSimulationFlavor(
  value: string | null | undefined,
): SimulationFlavor {
  if (value === "chalk" || value === "upsets") return value;
  return DEFAULT_SIMULATION_FLAVOR;
}

export const BASE_STRENGTH_WEIGHT = 0.26;
export const BASE_VARIANCE = 13;

export interface SimulationWeights {
  strengthWeight: number;
  variance: number;
  /** Scales PBP matchup-edge influence; 1 keeps balanced behavior unchanged. */
  edgeScale: number;
}

export function weightsForFlavor(flavor: SimulationFlavor): SimulationWeights {
  switch (flavor) {
    case "chalk":
      return {
        strengthWeight: BASE_STRENGTH_WEIGHT * 1.35,
        variance: BASE_VARIANCE * 0.7,
        edgeScale: 1.25,
      };
    case "upsets":
      return {
        strengthWeight: BASE_STRENGTH_WEIGHT * 0.75,
        variance: BASE_VARIANCE * 1.35,
        edgeScale: 0.75,
      };
    default:
      return {
        strengthWeight: BASE_STRENGTH_WEIGHT,
        variance: BASE_VARIANCE,
        edgeScale: 1,
      };
  }
}
