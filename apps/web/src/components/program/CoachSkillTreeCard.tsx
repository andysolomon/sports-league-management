"use client";

import { useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  COACH_SKILL_NODES,
  parseUnlockedNodesJson,
  prerequisitesMet,
  type CoachSkillsState,
} from "@/lib/program/coach-skills";
import { spendCoachSkillPointsAction } from "@/app/dashboard/_actions/coach-skills";

export function CoachSkillTreeCard({
  coachId,
  teamId,
  skillPoints,
  unlockedNodesJson,
  canEdit,
}: {
  coachId: string;
  teamId: string;
  skillPoints: number | null;
  unlockedNodesJson: string | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const state: CoachSkillsState = {
    skillPoints: skillPoints ?? 0,
    unlockedNodeIds: parseUnlockedNodesJson(unlockedNodesJson),
  };
  const unlocked = new Set(state.unlockedNodeIds);

  function spend(nodeId: string) {
    if (!canEdit) return;
    startTransition(async () => {
      await spendCoachSkillPointsAction({ coachId, teamId, nodeId });
    });
  }

  const branches = [
    { key: "development" as const, title: "Development" },
    { key: "recruiting" as const, title: "Recruiting" },
    { key: "gameplanning" as const, title: "Gameplanning" },
  ];

  return (
    <Card data-testid="coach-skill-tree">
      <CardHeader>
        <CardTitle>Skill tree</CardTitle>
        <p className="text-sm text-muted-foreground">
          {state.skillPoints} skill point{state.skillPoints === 1 ? "" : "s"}{" "}
          available
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        {branches.map((branch) => (
          <div key={branch.key} className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {branch.title}
            </p>
            <ul className="space-y-2">
              {COACH_SKILL_NODES.filter((n) => n.branch === branch.key).map(
                (node) => {
                  const isUnlocked = unlocked.has(node.id);
                  const prereqsOk = prerequisitesMet(state, node);
                  const canAfford = state.skillPoints >= node.cost;
                  const canSpend =
                    canEdit && !isUnlocked && prereqsOk && canAfford && !pending;

                  return (
                    <li
                      key={node.id}
                      className="rounded-md border border-border/60 p-3 text-sm"
                      data-testid={`skill-node-${node.id}`}
                    >
                      <div className="font-medium">{node.label}</div>
                      <p className="text-xs text-muted-foreground">
                        {node.description}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                        Cost: {node.cost}
                        {isUnlocked ? " · Unlocked" : ""}
                      </p>
                      {canEdit && (
                        <Button
                          type="button"
                          size="sm"
                          variant={isUnlocked ? "secondary" : "default"}
                          className="mt-2"
                          disabled={!canSpend}
                          data-testid={`skill-spend-${node.id}`}
                          onClick={() => spend(node.id)}
                        >
                          {isUnlocked ? "Owned" : "Unlock"}
                        </Button>
                      )}
                    </li>
                  );
                },
              )}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
