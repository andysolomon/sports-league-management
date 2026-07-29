/*
 * Season goals (Dynasty Mode C2) — pure, Convex-free.
 *
 * Goals are generated deterministically per `(teamId, seasonId)` and evaluated
 * from persisted F2/F3 aggregates only — never from per-game tables.
 */

import { mulberry32, seedFor } from "./rng";

export type GoalStatus = "met" | "missed" | "partial";

export type GoalMetric =
  | "wins"
  | "win_pct"
  | "points_for"
  | "points_against_max"
  | "team_passing_yards"
  | "team_rushing_yards"
  | "team_total_touchdowns";

export interface SeasonGoal {
  id: string;
  metric: GoalMetric;
  label: string;
  target: number;
}

export interface EvaluatedGoal extends SeasonGoal {
  status: GoalStatus;
  actual: number;
}

export interface TeamSeasonRecordInput {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface PlayerSeasonAggregateInput {
  totalsJson: string;
}

const GOAL_CATALOG: readonly Omit<SeasonGoal, "id">[] = [
  { metric: "wins", label: "Win at least {target} games", target: 7 },
  { metric: "wins", label: "Win at least {target} games", target: 9 },
  { metric: "win_pct", label: "Finish above {target}% win rate", target: 55 },
  { metric: "points_for", label: "Score at least {target} points", target: 280 },
  { metric: "points_against_max", label: "Allow fewer than {target} points", target: 220 },
  {
    metric: "team_passing_yards",
    label: "Throw for {target}+ yards as a team",
    target: 2200,
  },
  {
    metric: "team_rushing_yards",
    label: "Rush for {target}+ yards as a team",
    target: 1600,
  },
  {
    metric: "team_total_touchdowns",
    label: "Score {target}+ touchdowns",
    target: 35,
  },
] as const;

function formatLabel(template: string, target: number): string {
  return template.replace("{target}", String(target));
}

function pickGoalCount(teamId: string, seasonId: string): number {
  const rand = mulberry32(seedFor("goals", teamId, seasonId, "count"));
  return 3 + Math.floor(rand() * 3);
}

/** Deterministic 3–5 goals for a team season. */
export function generateGoals(teamId: string, seasonId: string): SeasonGoal[] {
  const rand = mulberry32(seedFor("goals", teamId, seasonId, "pick"));
  const count = pickGoalCount(teamId, seasonId);
  const indices = GOAL_CATALOG.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = tmp;
  }
  const picked = indices.slice(0, count);
  return picked.map((index, slot) => {
    const entry = GOAL_CATALOG[index]!;
    return {
      id: `${entry.metric}_${entry.target}_${slot}`,
      metric: entry.metric,
      label: formatLabel(entry.label, entry.target),
      target: entry.target,
    };
  });
}

function sumTeamStat(
  aggregates: readonly PlayerSeasonAggregateInput[],
  group: string,
  field: string,
): number {
  let total = 0;
  for (const row of aggregates) {
    try {
      const parsed = JSON.parse(row.totalsJson) as Record<
        string,
        Record<string, number>
      >;
      const value = parsed[group]?.[field];
      if (typeof value === "number" && Number.isFinite(value)) {
        total += value;
      }
    } catch {
      // ignore bad json
    }
  }
  return total;
}

function teamTouchdowns(aggregates: readonly PlayerSeasonAggregateInput[]): number {
  let total = 0;
  for (const row of aggregates) {
    try {
      const parsed = JSON.parse(row.totalsJson) as Record<
        string,
        Record<string, number>
      >;
      for (const group of Object.values(parsed)) {
        if (!group || typeof group !== "object") continue;
        for (const [field, value] of Object.entries(group)) {
          if (
            typeof value === "number" &&
            field.toLowerCase().includes("touchdown")
          ) {
            total += value;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return total;
}

function metricActual(
  metric: GoalMetric,
  record: TeamSeasonRecordInput,
  aggregates: readonly PlayerSeasonAggregateInput[],
): number {
  const games = record.wins + record.losses + record.ties;
  switch (metric) {
    case "wins":
      return record.wins;
    case "win_pct":
      return games > 0 ? Math.round((record.wins / games) * 100) : 0;
    case "points_for":
      return record.pointsFor;
    case "points_against_max":
      return record.pointsAgainst;
    case "team_passing_yards":
      return sumTeamStat(aggregates, "passing", "yards");
    case "team_rushing_yards":
      return sumTeamStat(aggregates, "rushing", "yards");
    case "team_total_touchdowns":
      return teamTouchdowns(aggregates);
    default: {
      const _exhaustive: never = metric;
      void _exhaustive;
      return 0;
    }
  }
}

function evaluateOne(
  goal: SeasonGoal,
  record: TeamSeasonRecordInput,
  aggregates: readonly PlayerSeasonAggregateInput[],
): EvaluatedGoal {
  const actual = metricActual(goal.metric, record, aggregates);
  let status: GoalStatus = "missed";

  if (goal.metric === "points_against_max") {
    if (actual < goal.target) status = "met";
    else if (actual <= goal.target + 25) status = "partial";
  } else if (goal.metric === "win_pct") {
    if (actual >= goal.target) status = "met";
    else if (actual >= goal.target - 8) status = "partial";
  } else if (actual >= goal.target) {
    status = "met";
  } else if (actual >= goal.target * 0.85) {
    status = "partial";
  }

  return { ...goal, status, actual };
}

export function evaluateGoals(
  goals: readonly SeasonGoal[],
  record: TeamSeasonRecordInput,
  aggregates: readonly PlayerSeasonAggregateInput[],
): EvaluatedGoal[] {
  return goals.map((goal) => evaluateOne(goal, record, aggregates));
}
