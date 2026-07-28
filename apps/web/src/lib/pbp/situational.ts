/*
 * Situational decisions and clock management (Dynasty Mode A3).
 *
 * Pure: no engine state, no I/O, and — importantly — **no PRNG**. Every
 * function here is deterministic. A coach who declines to punt on 4th-and-1
 * from midfield while trailing by 10 with two minutes left is not being lucky,
 * they are being correct, and the log should read that way every replay.
 *
 * That determinism is also what makes these functions cheap to gate: a decision
 * that draws no random number cannot desynchronize the v1 sequence, so the
 * `situational` gate is free to sit off in production without touching parity.
 *
 * ## Why a chart and not an expected-points model
 *
 * A full win-probability surface would need calibration data this project does
 * not have, and a mis-calibrated EP model is worse than an honest chart: it
 * looks authoritative while being wrong. What follows is the same shape as a
 * real 4th-down chart — a yards-to-go threshold per field zone — shifted by
 * score, time and coach aggression. Every boundary is a number you can point at
 * and argue with, which is the property that matters for tuning a game.
 */

/** Neutral coach. Used whenever a team carries no coach profile (pre-Epic C). */
export const NEUTRAL_AGGRESSION = 50;

export type FourthDownCall = "go" | "field_goal" | "punt";

export interface FourthDownInput {
  /** Yards needed for a first down. */
  yardsToGo: number;
  /** Distance from the opponent's goal line (0-100). */
  yardsToGoal: number;
  /** Offense score minus defense score. Negative means trailing. */
  scoreDiff: number;
  quarter: number;
  /** Seconds left in the current quarter. */
  clockSeconds: number;
  isOvertime: boolean;
  /** 0-100; 50 is neutral. Higher goes for it more often. */
  aggression: number;
}

/**
 * Seconds left in regulation.
 *
 * Overtime returns 0: there is no later quarter to defer to, so every OT
 * situation is treated as end-of-game urgent.
 */
export function secondsLeftInGame(
  quarter: number,
  clockSeconds: number,
  isOvertime: boolean,
): number {
  if (isOvertime) return 0;
  const quartersAfter = Math.max(0, 4 - quarter);
  return clockSeconds + quartersAfter * 720;
}

/** Seconds left in the current half — what a two-minute drill actually keys on. */
export function secondsLeftInHalf(
  quarter: number,
  clockSeconds: number,
  isOvertime: boolean,
): number {
  if (isOvertime) return clockSeconds;
  const endOfHalfQuarter = quarter <= 2 ? 2 : 4;
  return clockSeconds + Math.max(0, endOfHalfQuarter - quarter) * 720;
}

/** A field goal from this spot is at least worth attempting. */
export function inFieldGoalRange(yardsToGoal: number): boolean {
  // Attempt distance is the snap distance plus 17 yards of holder and end zone,
  // so 35 yards to goal is a 52-yard try — the edge of plausible for HS.
  return yardsToGoal <= 35;
}

/**
 * Baseline yards-to-go a team would still go for on 4th down, by field zone.
 *
 * The shape is the interesting part. It is NOT monotonic in field position,
 * because the alternative to going for it changes as you move:
 *
 * - Inside the 5, a field goal is nearly automatic, so the bar to go is low.
 * - From 6-20, the kick is still very makeable — the most conservative zone.
 * - From 21-35, the kick gets long and a punt gains almost nothing.
 * - From 36-50 there is no good alternative at all: too far to kick, too close
 *   to punt profitably. This is the peak.
 * - Beyond 50, failing hands the opponent a short field, so punt.
 */
function baseGoThreshold(yardsToGoal: number): number {
  if (yardsToGoal <= 5) return 3;
  if (yardsToGoal <= 20) return 2;
  if (yardsToGoal <= 35) return 3;
  if (yardsToGoal <= 50) return 5;
  return 1;
}

/**
 * Go for it, kick, or punt.
 *
 * Replaces the three hardcoded distance bands plus a coin flip that used to
 * live in `runScrimmagePlay`.
 */
export function fourthDownDecision(input: FourthDownInput): FourthDownCall {
  const { yardsToGo, yardsToGoal, scoreDiff } = input;
  const left = secondsLeftInGame(
    input.quarter,
    input.clockSeconds,
    input.isOvertime,
  );
  const kickable = inFieldGoalRange(yardsToGoal);

  /*
   * Desperation. Trailing late, a punt cannot win the game — it can only hand
   * the ball back with less time than you had. The only alternative worth
   * weighing is a field goal, and only when three points actually change the
   * outcome.
   */
  const trailing = scoreDiff < 0;
  const deficit = -scoreDiff;
  const desperate = trailing && left <= 300;
  if (desperate) {
    const fieldGoalTiesOrWins = deficit <= 3;
    // Under a minute, a field goal that leaves you still behind is worthless.
    if (kickable && fieldGoalTiesOrWins && (left <= 60 || yardsToGoal <= 25)) {
      return "field_goal";
    }
    if (left <= 120) return "go";
  }

  /*
   * Killing the game. Leading by more than one score inside the last few
   * minutes, the clock is the asset — do not risk a short field on 4th down.
   */
  const killingClock = scoreDiff > 8 && input.quarter >= 4 && left <= 240;

  let threshold = baseGoThreshold(yardsToGoal);
  threshold += (input.aggression - NEUTRAL_AGGRESSION) / 15;
  if (desperate) threshold += 4;
  else if (trailing && input.quarter >= 4) threshold += 2;
  if (killingClock) threshold -= 3;

  if (yardsToGo <= threshold) return "go";
  if (kickable) return "field_goal";
  return "punt";
}

/**
 * Kick onside?
 *
 * `scoreDiff` is from the KICKING team's perspective. Onside is a trailing
 * team's play: you are trading expected field position for the chance not to
 * give the ball back at all, which is only worth it when giving it back loses.
 */
export function shouldOnside(input: {
  scoreDiff: number;
  quarter: number;
  clockSeconds: number;
  isOvertime: boolean;
}): boolean {
  if (input.isOvertime) return false;
  if (input.scoreDiff >= 0) return false;
  const left = secondsLeftInGame(
    input.quarter,
    input.clockSeconds,
    input.isOvertime,
  );
  const deficit = -input.scoreDiff;
  if (left <= 120) return true;
  // Down more than a touchdown you need two possessions, so start earlier.
  return left <= 240 && deficit > 8;
}

export type ClockStrategy = "normal" | "hurry_up" | "burn";

/**
 * How the offense is treating the clock.
 *
 * `hurry_up` is the two-minute drill: get to the line, stop the clock, spend
 * timeouts. `burn` is its mirror — a lead to protect and a clock to drain.
 */
export function clockStrategy(input: {
  scoreDiff: number;
  quarter: number;
  clockSeconds: number;
  isOvertime: boolean;
}): ClockStrategy {
  if (input.isOvertime) return "normal";
  const half = secondsLeftInHalf(
    input.quarter,
    input.clockSeconds,
    input.isOvertime,
  );
  const game = secondsLeftInGame(
    input.quarter,
    input.clockSeconds,
    input.isOvertime,
  );

  if (input.scoreDiff > 0 && input.quarter >= 4 && game <= 300) return "burn";
  /*
   * Hurrying at the end of the FIRST half is not about the score — points
   * before the break are free either way, so a tie or even a small lead still
   * hurries. At the end of the game it is only worth it when you need points.
   */
  if (half <= 120) {
    if (input.quarter <= 2) return "hurry_up";
    if (input.scoreDiff <= 0) return "hurry_up";
  }
  return "normal";
}

/**
 * Seconds that elapse between plays, on top of the play itself.
 *
 * Zero when the clock is stopped. This split — play duration versus the huddle
 * and play clock that follow — is the whole reason v1 ran short of plays: it
 * charged a full ~30-second cycle to every snap, including incompletions that
 * stop the clock in real football.
 */
export function runoffSeconds(
  strategy: ClockStrategy,
  clockStopped: boolean,
): number {
  if (clockStopped) return 0;
  if (strategy === "hurry_up") return 12;
  if (strategy === "burn") return 38;
  return 30;
}

/**
 * Spike the ball to stop the clock.
 *
 * A spike costs a down, so it is only right when the clock is the binding
 * constraint and there is no timeout left to spend. Never on 4th down — that
 * would surrender possession to save six seconds.
 */
export function shouldSpike(input: {
  strategy: ClockStrategy;
  secondsLeftInHalf: number;
  down: number;
  timeoutsRemaining: number;
  clockStopped: boolean;
}): boolean {
  if (input.strategy !== "hurry_up") return false;
  if (input.clockStopped) return false;
  if (input.timeoutsRemaining > 0) return false;
  if (input.down >= 4) return false;
  return input.secondsLeftInHalf <= 40;
}

/**
 * Spend a timeout.
 *
 * Two callers with opposite motives, which is why `isOffense` is an input
 * rather than two functions: the offense stops the clock to keep its own drive
 * alive, the defense stops it to get the ball back at all. Both are late-game
 * behaviors and both are bounded by the same pool.
 */
export function shouldUseTimeout(input: {
  isOffense: boolean;
  scoreDiff: number;
  secondsLeftInHalf: number;
  secondsLeftInGame: number;
  quarter: number;
  timeoutsRemaining: number;
  clockStopped: boolean;
}): boolean {
  if (input.timeoutsRemaining <= 0) return false;
  if (input.clockStopped) return false;

  if (input.isOffense) {
    if (input.secondsLeftInHalf > 90) return false;
    // First half: points before the break are worth a timeout regardless of
    // score. Second half: only when you need them.
    return input.quarter <= 2 || input.scoreDiff <= 0;
  }

  // Defense: trailing, in the last two minutes, with the opponent's offense
  // sitting on the ball.
  if (input.quarter < 4) return false;
  return input.scoreDiff < 0 && input.secondsLeftInGame <= 120;
}
