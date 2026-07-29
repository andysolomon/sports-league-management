/*
 * Coach skill tree (Dynasty Mode C4) — see `convex/lib/coachSkills.ts`.
 */

export {
  COACH_SKILL_NODES,
  applySkill,
  coachSkillsStateFromRow,
  computeSeasonSkillPointsAward,
  getSkillNode,
  parseUnlockedNodesJson,
  prerequisitesMet,
  ratingsFromSkillState,
  serializeUnlockedNodes,
} from "../../../convex/lib/coachSkills";

export type {
  ApplySkillResult,
  CoachSkillRatings,
  CoachSkillsState,
  SeasonSkillPointsInput,
  SkillBranch,
  SkillNode,
  SkillNodeEffect,
  SkillSpendRejection,
} from "../../../convex/lib/coachSkills";
