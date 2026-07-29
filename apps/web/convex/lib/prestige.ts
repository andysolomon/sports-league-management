/*
 * Program prestige (Dynasty Mode C2) — pure, Convex-free.
 *
 * ## Properties
 *
 * 1. **Bounded swing.** A single season moves prestige by at most 12 points so
 *    one catastrophic year cannot erase a decade of brand equity in one step.
 * 2. **Hard rails.** Prestige always lives in 0..100 after a season closes.
 * 3. **Hysteresis.** Blue-blood programs shed less on a bad year; rebuilding
 *    programs gain less on a lone good year — multi-year arcs matter.
 */

import type { EvaluatedGoal } from "./goals";

export const PRESTIGE_MIN = 0;
export const PRESTIGE_MAX = 100;
export const PRESTIGE_DELTA_CAP = 12;
/** Neutral prestige when a program has never been modelled. */
export const PRESTIGE_NEUTRAL = 50;

export interface PrestigeSeasonOutcome {
  wins: number;
  losses: number;
  ties: number;
  evaluatedGoals: readonly EvaluatedGoal[];
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function goalScore(goals: readonly EvaluatedGoal[]): number {
  if (goals.length === 0) return 0;
  let points = 0;
  for (const goal of goals) {
    if (goal.status === "met") points += 2;
    else if (goal.status === "partial") points += 1;
    else points -= 1;
  }
  return points / goals.length;
}

/** Raw delta before cap and hysteresis, from record + goals only. */
export function rawPrestigeDelta(outcome: PrestigeSeasonOutcome): number {
  const games = outcome.wins + outcome.losses + outcome.ties;
  const winPct = games > 0 ? outcome.wins / games : 0;
  const recordComponent = (winPct - 0.5) * 24;
  const goalComponent = goalScore(outcome.evaluatedGoals) * 4;
  return recordComponent + goalComponent;
}

export interface ApplyPrestigeResult {
  prestige: number;
  delta: number;
}

/**
 * Apply a season outcome to program prestige. Uses `current ?? PRESTIGE_NEUTRAL`
 * only for arithmetic — callers persist explicit prestige when they first model
 * a program.
 */
export function applyPrestigeDelta(
  current: number | null,
  outcome: PrestigeSeasonOutcome,
): ApplyPrestigeResult {
  const base = current ?? PRESTIGE_NEUTRAL;
  let delta = rawPrestigeDelta(outcome);

  if (base >= 70 && delta < 0) {
    delta *= 0.55;
  } else if (base <= 30 && delta > 0) {
    delta *= 0.55;
  }

  delta = clamp(delta, -PRESTIGE_DELTA_CAP, PRESTIGE_DELTA_CAP);
  const prestige = clamp(base + delta, PRESTIGE_MIN, PRESTIGE_MAX);
  return { prestige, delta: prestige - base };
}
