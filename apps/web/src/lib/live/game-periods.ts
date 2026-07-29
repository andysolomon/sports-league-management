/**
 * Football period structure — see `convex/lib/gamePeriods.ts`.
 *
 * Canonical under `convex/` because `updateLiveState` validates the bound
 * server-side; re-exported here so the scoreboard renders the same labels the
 * server accepts.
 */
export {
  REGULATION_PERIODS,
  MAX_OVERTIME_PERIODS,
  MAX_PERIOD,
  isRegulationPeriod,
  isOvertimePeriod,
  isValidPeriod,
  formatPeriodLabel,
  nextPeriodLabel,
  nextPeriod,
} from "../../../convex/lib/gamePeriods";
