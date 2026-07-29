/*
 * Offseason training rules (Dynasty Mode B6) — see `convex/lib/training.ts`.
 *
 * Canonical under `convex/` because the mutation enforces the budget and the
 * panel previews the gain; re-exported here so the Next layer imports it the
 * same way it imports every other dynasty lib. Same arrangement as `scouting.ts`
 * (B3), `transfers.ts` (B4) and `promotions.ts` (B5).
 */

export {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  NEUTRAL_RATING,
  TRAINING_FOCUSES,
  TRAINING_POINT_OPTIONS,
  TRAINING_YIELD,
  applyTraining,
  focusAttributeKeys,
  isTrainingFocus,
  totalAllocatedPoints,
  trainingBonus,
  trainingGate,
} from "../../../convex/lib/training";

export type {
  AppliedTraining,
  ApplyTrainingInput,
  TrainingAllocation,
  TrainingBonusInput,
  TrainingBudgetInput,
  TrainingDecision,
  TrainingFocus,
  TrainingFocusMeta,
  TrainingRejection,
} from "../../../convex/lib/training";
