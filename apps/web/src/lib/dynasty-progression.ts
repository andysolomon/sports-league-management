/**
 * Dynasty offseason attribute progression — seeded, position-weighted development
 * deltas applied to a player's prior-season snapshot.
 */
import { mulberry32, seedFromString } from "@/lib/simulate-game";
import { attributeGroupForPosition } from "@/lib/synthetic-attributes";

const ATTRIBUTE_GROUPS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "OL",
  "DL",
  "LB",
  "DB",
  "K",
  "P",
] as const;

/** Position-tilted attribute keys (higher weight → larger typical gain). */
const POSITION_ATTR_WEIGHTS: Readonly<
  Record<string, Partial<Record<string, number>>>
> = {
  QB: { THP: 1.4, SAC: 1.2, AWR: 1.3, SPD: 0.8 },
  RB: { SPD: 1.5, AGI: 1.3, ACC: 1.2, CAR: 1.1 },
  WR: { SPD: 1.4, CTH: 1.2, SRR: 1.2, AGI: 1.1 },
  TE: { CTH: 1.3, STR: 1.2, SPD: 1.0 },
  OL: { STR: 1.4, RBK: 1.2, PBK: 1.2 },
  DL: { STR: 1.3, PMV: 1.2, FMV: 1.2, BSH: 1.1 },
  LB: { SPD: 1.2, TAK: 1.3, PRC: 1.2, AWR: 1.1 },
  DB: { SPD: 1.4, AGI: 1.3, MCV: 1.2, ZCV: 1.2 },
  K: { KPW: 1.2, KAC: 1.2 },
  P: { KPW: 1.2, KAC: 1.2 },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function weightedOverall(attributes: Record<string, number>): number {
  const values = Object.values(attributes);
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return clamp(Math.round(sum / values.length), 0, 99);
}

function attrWeight(positionGroup: string, key: string): number {
  return POSITION_ATTR_WEIGHTS[positionGroup]?.[key] ?? 1;
}

export interface ProgressionInput {
  playerId: string;
  newSeasonId: string;
  position: string;
  /** Grade before advancement (9–11); grade 9 ⇒ larger FR→SO jump. */
  previousGrade: number | null;
  previousAttributes: Record<string, number>;
  positionGroup?: string;
}

export interface ProgressionResult {
  positionGroup: string;
  attributes: Record<string, number>;
  weightedOverall: number;
}

/**
 * Deterministic per (playerId, newSeasonId). Mean overall-equivalent gain is
 * +2–4 per year (+3–5 when previousGrade was 9) with per-attribute variance.
 */
export function computeProgressedAttributes(
  input: ProgressionInput,
): ProgressionResult {
  const positionGroup =
    input.positionGroup ?? attributeGroupForPosition(input.position);
  const seed = seedFromString(`${input.playerId}:${input.newSeasonId}`);
  const rand = mulberry32(seed);

  const keys = Object.keys(input.previousAttributes);
  if (keys.length === 0) {
    return { positionGroup, attributes: {}, weightedOverall: 0 };
  }

  const overallBoost =
    input.previousGrade === 9
      ? 3 + Math.floor(rand() * 3)
      : 2 + Math.floor(rand() * 3);

  const weights = keys.map((k) => attrWeight(positionGroup, k));
  const weightSum = weights.reduce((a, b) => a + b, 0) || keys.length;

  const attributes: Record<string, number> = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const share = (weights[i]! / weightSum) * overallBoost;
    const variance = Math.floor(rand() * 5) - 2;
    attributes[key] = clamp(
      Math.round((input.previousAttributes[key] ?? 0) + share + variance),
      0,
      99,
    );
  }

  return {
    positionGroup,
    attributes,
    weightedOverall: weightedOverall(attributes),
  };
}

export { ATTRIBUTE_GROUPS };
