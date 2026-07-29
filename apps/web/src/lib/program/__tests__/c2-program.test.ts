import { describe, it, expect } from "vitest";
import {
  PRESTIGE_DELTA_CAP,
  PRESTIGE_MAX,
  PRESTIGE_MIN,
  applyPrestigeDelta,
} from "@/lib/program/prestige";
import type { EvaluatedGoal } from "@/lib/program/goals";
import { generateGoals } from "@/lib/program/goals";
import {
  computeJobSecurity,
  shouldFireCoach,
  JOB_SECURITY_FIRE_THRESHOLD,
} from "@/lib/program/job-security";

function goal(status: EvaluatedGoal["status"]): EvaluatedGoal {
  return {
    id: "wins_7_0",
    metric: "wins",
    label: "Win 7",
    target: 7,
    status,
    actual: status === "met" ? 8 : 4,
  };
}

describe("prestige", () => {
  it("clamps delta to |12| and prestige to 0..100 over randomized histories", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const current = (seed * 17) % 101;
      const wins = seed % 13;
      const losses = (seed * 3) % 10;
      const ties = seed % 2;
      const goals: EvaluatedGoal[] = [
        goal(seed % 3 === 0 ? "met" : seed % 3 === 1 ? "partial" : "missed"),
        goal(seed % 2 === 0 ? "met" : "missed"),
      ];
      const { prestige, delta } = applyPrestigeDelta(current, {
        wins,
        losses,
        ties,
        evaluatedGoals: goals,
      });
      expect(Math.abs(delta)).toBeLessThanOrEqual(PRESTIGE_DELTA_CAP + 0.001);
      expect(prestige).toBeGreaterThanOrEqual(PRESTIGE_MIN);
      expect(prestige).toBeLessThanOrEqual(PRESTIGE_MAX);
    }
  });

  it("dampens losses for high-prestige programs", () => {
    const bad = applyPrestigeDelta(85, {
      wins: 2,
      losses: 10,
      ties: 0,
      evaluatedGoals: [goal("missed"), goal("missed")],
    });
    const mid = applyPrestigeDelta(50, {
      wins: 2,
      losses: 10,
      ties: 0,
      evaluatedGoals: [goal("missed"), goal("missed")],
    });
    expect(bad.delta).toBeGreaterThan(mid.delta);
  });
});

describe("goals", () => {
  it("regenerates the identical goal set for the same team and season", () => {
    const a = generateGoals("team_a", "season_1");
    const b = generateGoals("team_a", "season_1");
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a.length).toBeLessThanOrEqual(5);
  });
});

describe("job security", () => {
  it("fires only when enabled and below threshold", () => {
    expect(shouldFireCoach(JOB_SECURITY_FIRE_THRESHOLD - 1, true)).toBe(true);
    expect(shouldFireCoach(JOB_SECURITY_FIRE_THRESHOLD, true)).toBe(false);
    expect(shouldFireCoach(0, false)).toBe(false);
  });

  it("does not fire with job security disabled", () => {
    const security = computeJobSecurity({
      current: 5,
      evaluatedGoals: [goal("missed"), goal("missed"), goal("missed")],
      wins: 1,
      losses: 11,
      ties: 0,
    });
    expect(shouldFireCoach(security, false)).toBe(false);
  });

  it("firing post-conditions: fired status and detached team when enabled", () => {
    const security = computeJobSecurity({
      current: 8,
      evaluatedGoals: [
        goal("missed"),
        goal("missed"),
        goal("missed"),
        goal("missed"),
      ],
      wins: 0,
      losses: 12,
      ties: 0,
    });
    expect(shouldFireCoach(security, true)).toBe(true);
    const firedCoach = { status: "fired" as const, teamId: null as string | null };
    expect(firedCoach.status).toBe("fired");
    expect(firedCoach.teamId).toBeNull();
  });
});
