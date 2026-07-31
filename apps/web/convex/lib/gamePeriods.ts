/**
 * Football period structure for the live scoreboard.
 *
 * `liveGameState.period` has always been documented as "1..4; OT = 5+", but
 * nothing enforced or rendered that: the server accepted any integer >= 1 and
 * the operator UI printed a bare "Period 7". Football has exactly four
 * quarters, and everything after them is overtime.
 *
 * The bound exists because an unbounded counter on a persisted field is the
 * actual defect — a stuck "next period" button could write Period 400. It is
 * deliberately generous: no real game reaches ten overtimes, so the cap stops
 * nonsense without ever blocking a legitimate one.
 */

/** Quarters in a regulation football game. */
export const REGULATION_PERIODS = 4;

/** Overtime periods allowed past regulation before we call the value bogus. */
export const MAX_OVERTIME_PERIODS = 10;

export const MAX_PERIOD = REGULATION_PERIODS + MAX_OVERTIME_PERIODS;

export function isRegulationPeriod(period: number): boolean {
  return period >= 1 && period <= REGULATION_PERIODS;
}

export function isOvertimePeriod(period: number): boolean {
  return period > REGULATION_PERIODS;
}

/** True for an integer period inside 1..MAX_PERIOD. */
export function isValidPeriod(period: number): boolean {
  return Number.isInteger(period) && period >= 1 && period <= MAX_PERIOD;
}

/**
 * "Q1".."Q4", then "OT", "2OT", "3OT" — the scoreboard convention. A value
 * outside the valid range is rendered rather than thrown on, so a legacy row
 * written before the bound existed still displays instead of blanking the
 * scoreboard.
 */
export function formatPeriodLabel(period: number): string {
  if (!Number.isInteger(period) || period < 1) return "—";
  if (period <= REGULATION_PERIODS) return `Q${period}`;
  const overtimeNumber = period - REGULATION_PERIODS;
  return overtimeNumber === 1 ? "OT" : `${overtimeNumber}OT`;
}

/**
 * Label for the control that advances the period, so the operator knows
 * whether they are moving between quarters or starting an extra period.
 */
export function nextPeriodLabel(period: number): string {
  if (period < REGULATION_PERIODS) return "Next quarter";
  if (period === REGULATION_PERIODS) return "Start overtime";
  return "Next overtime";
}

/** The next period, or null when the cap has been reached. */
export function nextPeriod(period: number): number | null {
  if (!Number.isInteger(period) || period < 1) return null;
  return period < MAX_PERIOD ? period + 1 : null;
}
