/*
 * Coach skill tree (Dynasty Mode C4) — pure, Convex-free.
 *
 * Skill points are earned at season finalization and spent on nodes that raise
 * development, recruiting and gameplan ratings. Gameplay reads those ratings
 * through the existing B6/B3 helpers; until a coach unlocks a branch, ratings
 * stay absent so training and prospect generation match pre-C4 behavior.
 */
import type { EvaluatedGoal } from "./goals";
import { NEUTRAL_RATING } from "./training";

export type SkillBranch = "development" | "recruiting" | "gameplanning";

export interface SkillNodeEffect {
  developmentRating?: number;
  recruitingRating?: number;
  gameplanRating?: number;
}

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  label: string;
  description: string;
  cost: number;
  prerequisites: readonly string[];
  effect: SkillNodeEffect;
}

export interface CoachSkillsState {
  skillPoints: number;
  unlockedNodeIds: readonly string[];
}

export interface CoachSkillRatings {
  developmentRating: number | null;
  recruitingRating: number | null;
  gameplanRating: number | null;
}

export type SkillSpendRejection =
  | "unknown_node"
  | "prerequisites_not_met"
  | "insufficient_points"
  | "already_unlocked";

export type ApplySkillResult =
  | { ok: true; state: CoachSkillsState; ratings: CoachSkillRatings }
  | { ok: false; reason: SkillSpendRejection };

export const COACH_SKILL_NODES: readonly SkillNode[] = [
  {
    id: "dev_fundamentals",
    branch: "development",
    label: "Fundamentals",
    description: "Teach technique in every drill.",
    cost: 1,
    prerequisites: [],
    effect: { developmentRating: 5 },
  },
  {
    id: "dev_pipeline",
    branch: "development",
    label: "Pipeline",
    description: "Identify and grow depth before it is needed.",
    cost: 1,
    prerequisites: ["dev_fundamentals"],
    effect: { developmentRating: 5 },
  },
  {
    id: "dev_elite",
    branch: "development",
    label: "Elite development",
    description: "Turn starters into All-Conference players.",
    cost: 1,
    prerequisites: ["dev_pipeline"],
    effect: { developmentRating: 10 },
  },
  {
    id: "rec_network",
    branch: "recruiting",
    label: "Regional network",
    description: "Relationships with high-school coaches.",
    cost: 1,
    prerequisites: [],
    effect: { recruitingRating: 5 },
  },
  {
    id: "rec_scouting",
    branch: "recruiting",
    label: "Scouting staff",
    description: "More eyes on Friday nights.",
    cost: 1,
    prerequisites: ["rec_network"],
    effect: { recruitingRating: 5 },
  },
  {
    id: "rec_national",
    branch: "recruiting",
    label: "National reach",
    description: "Compete for prospects outside your footprint.",
    cost: 1,
    prerequisites: ["rec_scouting"],
    effect: { recruitingRating: 10 },
  },
  {
    id: "gp_film",
    branch: "gameplanning",
    label: "Film study",
    description: "Find tendencies before kickoff.",
    cost: 1,
    prerequisites: [],
    effect: { gameplanRating: 5 },
  },
  {
    id: "gp_adjustments",
    branch: "gameplanning",
    label: "Halftime adjustments",
    description: "Answer what the opponent showed in Q1.",
    cost: 1,
    prerequisites: ["gp_film"],
    effect: { gameplanRating: 5 },
  },
  {
    id: "gp_mastery",
    branch: "gameplanning",
    label: "Gameplan mastery",
    description: "Win the chess match week after week.",
    cost: 1,
    prerequisites: ["gp_adjustments"],
    effect: { gameplanRating: 10 },
  },
] as const;

const NODE_BY_ID = new Map(COACH_SKILL_NODES.map((node) => [node.id, node]));

export function getSkillNode(nodeId: string): SkillNode | undefined {
  return NODE_BY_ID.get(nodeId);
}

export function parseUnlockedNodesJson(
  json: string | null | undefined,
): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function coachSkillsStateFromRow(input: {
  skillPoints?: number | null;
  unlockedNodesJson?: string | null;
}): CoachSkillsState {
  return {
    skillPoints:
      typeof input.skillPoints === "number" && Number.isFinite(input.skillPoints)
        ? Math.max(0, Math.floor(input.skillPoints))
        : 0,
    unlockedNodeIds: parseUnlockedNodesJson(input.unlockedNodesJson),
  };
}

/** Ratings contributed by unlocked nodes only; absent branches stay null. */
export function ratingsFromSkillState(
  state: CoachSkillsState,
): CoachSkillRatings {
  const unlocked = new Set(state.unlockedNodeIds);
  let development = 0;
  let recruiting = 0;
  let gameplan = 0;
  let hasDevelopment = false;
  let hasRecruiting = false;
  let hasGameplan = false;

  for (const node of COACH_SKILL_NODES) {
    if (!unlocked.has(node.id)) continue;
    if (node.effect.developmentRating) {
      hasDevelopment = true;
      development += node.effect.developmentRating;
    }
    if (node.effect.recruitingRating) {
      hasRecruiting = true;
      recruiting += node.effect.recruitingRating;
    }
    if (node.effect.gameplanRating) {
      hasGameplan = true;
      gameplan += node.effect.gameplanRating;
    }
  }

  return {
    developmentRating: hasDevelopment ? NEUTRAL_RATING + development : null,
    recruitingRating: hasRecruiting ? NEUTRAL_RATING + recruiting : null,
    gameplanRating: hasGameplan ? NEUTRAL_RATING + gameplan : null,
  };
}

export function prerequisitesMet(
  state: CoachSkillsState,
  node: SkillNode,
): boolean {
  const unlocked = new Set(state.unlockedNodeIds);
  return node.prerequisites.every((id) => unlocked.has(id));
}

/**
 * Spend one node. Idempotent per nodeId: a repeat spend returns the same state
 * without charging again.
 */
export function applySkill(
  state: CoachSkillsState,
  nodeId: string,
): ApplySkillResult {
  const node = getSkillNode(nodeId);
  if (!node) return { ok: false, reason: "unknown_node" };

  const unlocked = new Set(state.unlockedNodeIds);
  if (unlocked.has(nodeId)) {
    return {
      ok: true,
      state,
      ratings: ratingsFromSkillState(state),
    };
  }

  if (!prerequisitesMet(state, node)) {
    return { ok: false, reason: "prerequisites_not_met" };
  }
  if (state.skillPoints < node.cost) {
    return { ok: false, reason: "insufficient_points" };
  }

  const next: CoachSkillsState = {
    skillPoints: state.skillPoints - node.cost,
    unlockedNodeIds: [...state.unlockedNodeIds, nodeId].sort(),
  };
  return {
    ok: true,
    state: next,
    ratings: ratingsFromSkillState(next),
  };
}

export interface SeasonSkillPointsInput {
  evaluatedGoals: readonly EvaluatedGoal[];
  prestigeDelta: number;
}

/** Pure award used at season finalization and in convex-test. */
export function computeSeasonSkillPointsAward(
  input: SeasonSkillPointsInput,
): number {
  const met = input.evaluatedGoals.filter((g) => g.status === "met").length;
  const prestigeBonus =
    input.prestigeDelta > 0 ? Math.floor(input.prestigeDelta / 4) : 0;
  return met + prestigeBonus;
}

export function serializeUnlockedNodes(nodeIds: readonly string[]): string {
  return JSON.stringify([...nodeIds].sort());
}
