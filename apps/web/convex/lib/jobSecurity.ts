/*
 * Coach job security (Dynasty Mode C2) — pure, Convex-free.
 *
 * The seat heats and cools from goal results; firing is a separate decision
 * gated by `jobSecurityEnabled` at the mutation layer.
 */

import type { EvaluatedGoal } from "./goals";

export const JOB_SECURITY_MIN = 0;
export const JOB_SECURITY_MAX = 100;
export const JOB_SECURITY_NEUTRAL = 50;
export const JOB_SECURITY_FIRE_THRESHOLD = 12;

export interface JobSecurityInput {
  current: number | null;
  evaluatedGoals: readonly EvaluatedGoal[];
  wins: number;
  losses: number;
  ties: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function computeJobSecurity(input: JobSecurityInput): number {
  let value = input.current ?? JOB_SECURITY_NEUTRAL;
  for (const goal of input.evaluatedGoals) {
    if (goal.status === "met") value += 6;
    else if (goal.status === "partial") value += 2;
    else value -= 9;
  }

  const games = input.wins + input.losses + input.ties;
  if (games > 0) {
    const winPct = input.wins / games;
    if (winPct >= 0.65) value += 4;
    else if (winPct < 0.35) value -= 6;
  }

  return clamp(value, JOB_SECURITY_MIN, JOB_SECURITY_MAX);
}

export function shouldFireCoach(
  jobSecurity: number,
  jobSecurityEnabled: boolean,
): boolean {
  if (!jobSecurityEnabled) return false;
  return jobSecurity < JOB_SECURITY_FIRE_THRESHOLD;
}
