/**
 * Hall of Fame rules live under convex/lib so rollover persistence and the
 * Next test surface use exactly the same pure implementation.
 */
export {
  HOF_CLASS_SIZE,
  HOF_WAITING_SEASONS,
  eligibleClass,
  hofScore,
} from "../../../convex/lib/hallOfFame";

export type {
  EligibleClassOptions,
  HallOfFameCandidate,
  HofScoreInput,
} from "../../../convex/lib/hallOfFame";
