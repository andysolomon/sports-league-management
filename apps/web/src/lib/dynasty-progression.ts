/**
 * Dynasty offseason attribute progression — seeded, position-weighted development
 * deltas applied to a player's prior-season snapshot.
 */
import { mulberry32, seedFromString } from "@/lib/simulate-game";
import { attributeGroupForPosition } from "@/lib/synthetic-attributes";
/*
 * The development weights moved to `convex/lib/positions.ts` in B5, where
 * B5's `positionChangeFit` also reads them. Progression asks where a player's
 * growth GOES; fit asks whether the athlete he already is SUITS a position.
 * Same emphasis, opposite directions — two tables that agreed by coincidence
 * would drift the first time either was tuned.
 */
import { attrWeight } from "../../convex/lib/positions";
import {
  applyTraining,
  type TrainingAllocation,
} from "../../convex/lib/training";

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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function weightedOverall(attributes: Record<string, number>): number {
  const values = Object.values(attributes);
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return clamp(Math.round(sum / values.length), 0, 99);
}

export interface ProgressionInput {
  playerId: string;
  newSeasonId: string;
  position: string;
  /** Grade before advancement (9–11); grade 9 ⇒ larger FR→SO jump. */
  previousGrade: number | null;
  previousAttributes: Record<string, number>;
  positionGroup?: string;
  /*
   * Training a coach bought for this player (B6). Optional, and absent means
   * absent — not zero — so every caller that predates B6 gets a byte-identical
   * result. Applied AFTER the seeded base delta and outside its RNG stream, so
   * adding training cannot shift a single natural-growth draw.
   *
   * The offseason applies training on its own, additively, because it runs
   * after the rollover has already progressed everyone (see
   * `applyTrainingAllocations` in `convex/dynasty.ts`). This hook is for the
   * other direction: a rollover that ever carries an unapplied spring forward,
   * and C4's development economy, which will supply `developmentMultiplier`
   * from a coach's development rating.
   */
  training?: readonly TrainingAllocation[];
  /** Scales what training buys. Absent is neutral, not zero — see B6. */
  developmentMultiplier?: number | null;
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

  /*
   * Training lands on top of the finished base delta, never inside it. Placing
   * it here — after the RNG stream is exhausted — is what makes the B6 promise
   * checkable: with `training` absent or empty the function has not drawn a
   * different number, taken a different branch, or rounded differently, so the
   * result is byte-identical to the pre-B6 one for the same seed.
   */
  const trained =
    input.training && input.training.length > 0
      ? applyTraining({
          attributes,
          positionGroup,
          allocations: input.training,
          multiplier: input.developmentMultiplier,
        }).attributes
      : attributes;

  return {
    positionGroup,
    attributes: trained,
    weightedOverall: weightedOverall(trained),
  };
}

export { ATTRIBUTE_GROUPS };
