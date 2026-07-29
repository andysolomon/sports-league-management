/*
 * Roster shaping rules (Dynasty Mode B5) — see `convex/lib/promotions.ts`.
 *
 * Canonical under `convex/` because the mutation enforces these rules and the
 * panel previews them; re-exported here so the Next layer imports it the same
 * way it imports every other dynasty lib. Same arrangement as `scouting.ts`
 * (B3) and `transfers.ts` (B4).
 */

export {
  JV,
  MANDATORY_VARSITY_GRADE,
  MIN_PROMOTION_GRADE,
  VARSITY,
  isSquad,
  positionChangeFit,
  recommendPromotions,
  squadChange,
} from "../../../convex/lib/promotions";

export type {
  PositionFitInput,
  PromotionRecommendation,
  RosterPlayer,
  Squad,
  SquadChangeDecision,
  SquadChangeInput,
  SquadChangeRejection,
} from "../../../convex/lib/promotions";

export { POSITION_CHANGE_OPTIONS } from "../../../convex/lib/positions";
