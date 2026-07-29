import { describe, it, expect } from "vitest";
import {
  COACH_SKILL_NODES,
  applySkill,
  computeSeasonSkillPointsAward,
  getSkillNode,
  ratingsFromSkillState,
  type CoachSkillsState,
} from "@/lib/program/coach-skills";
import { trainingBonus } from "@/lib/dynasty/training";
import { generateProspectClass } from "@/lib/dynasty/prospects";

describe("coach skill tree nodes", () => {
  it("each node has prerequisites and effect wired consistently", () => {
    for (const node of COACH_SKILL_NODES) {
      expect(getSkillNode(node.id)).toEqual(node);
      for (const prereq of node.prerequisites) {
        expect(getSkillNode(prereq)).toBeDefined();
      }
      const empty: CoachSkillsState = { skillPoints: 10, unlockedNodeIds: [] };
      if (node.prerequisites.length > 0) {
        expect(applySkill(empty, node.id).ok).toBe(false);
      }
      let state: CoachSkillsState = { skillPoints: 20, unlockedNodeIds: [] };
      const unlockChain = (targetId: string) => {
        const target = getSkillNode(targetId);
        if (!target) return;
        for (const prereq of target.prerequisites) unlockChain(prereq);
        if (!state.unlockedNodeIds.includes(targetId)) {
          const step = applySkill(state, targetId);
          expect(step.ok).toBe(true);
          if (step.ok) state = step.state;
        }
      };
      unlockChain(node.id);
      const unlock = applySkill(state, node.id);
      expect(unlock.ok).toBe(true);
      if (unlock.ok) {
        const ratings = ratingsFromSkillState(unlock.state);
        if (node.effect.developmentRating) {
          expect(ratings.developmentRating).toBeGreaterThan(50);
        }
        if (node.effect.recruitingRating) {
          expect(ratings.recruitingRating).toBeGreaterThan(50);
        }
        if (node.effect.gameplanRating) {
          expect(ratings.gameplanRating).toBeGreaterThan(50);
        }
      }
    }
  });

  it("spending the same node twice applies one effect and keeps balance non-negative", () => {
    let state: CoachSkillsState = { skillPoints: 5, unlockedNodeIds: [] };
    const first = applySkill(state, "dev_fundamentals");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;
    const second = applySkill(state, "dev_fundamentals");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.skillPoints).toBe(state.skillPoints);
    expect(second.state.unlockedNodeIds).toEqual(state.unlockedNodeIds);
    expect(second.state.skillPoints).toBeGreaterThanOrEqual(0);
  });
});

describe("computeSeasonSkillPointsAward", () => {
  it("awards met goals plus prestige bonus", () => {
    const award = computeSeasonSkillPointsAward({
      evaluatedGoals: [
        {
          id: "g1",
          metric: "wins",
          label: "Win 7",
          target: 7,
          status: "met",
          actual: 8,
        },
        {
          id: "g2",
          metric: "wins",
          label: "Win 8",
          target: 8,
          status: "missed",
          actual: 4,
        },
      ],
      prestigeDelta: 9,
    });
    expect(award).toBe(1 + Math.floor(9 / 4));
  });
});

describe("coach ratings feed B6 and B3", () => {
  const baseTraining = {
    focus: "athleticism",
    points: 10,
    positionGroup: "RB",
  };

  it("higher development rating yields larger training bonus", () => {
    const low = trainingBonus({ ...baseTraining, developmentRating: 55 });
    const high = trainingBonus({ ...baseTraining, developmentRating: 75 });
    expect(high).toBeGreaterThan(low);
  });

  it("zero skill investment matches neutral training (no developmentRating)", () => {
    const neutral = trainingBonus(baseTraining);
    const withNeutralRating = trainingBonus({
      ...baseTraining,
      developmentRating: 50,
    });
    expect(withNeutralRating).toBe(neutral);
  });

  it("higher recruiting rating yields stronger prospect class for a fixed seed", () => {
    const weak = generateProspectClass({
      seasonId: "season_skill_test",
      count: 24,
      recruitingRating: 50,
    });
    const strong = generateProspectClass({
      seasonId: "season_skill_test",
      count: 24,
      recruitingRating: 80,
    });
    const avg = (rows: typeof weak) =>
      rows.reduce((sum, p) => sum + p.trueOverall, 0) / rows.length;
    expect(avg(strong)).toBeGreaterThan(avg(weak));
  });
});
